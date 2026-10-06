const express=require('express');
const http=require('http');
const path=require('path');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const {Pool}=require('pg');
const {Server}=require('socket.io');

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:true}});
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false});
const SECRET=process.env.JWT_SECRET||'dev-only-secret';

app.use(express.json({limit:'2mb'}));
app.use(express.static(path.join(__dirname,'../public')));

async function init(){
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE TABLE IF NOT EXISTS users(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, nickname TEXT UNIQUE NOT NULL, bio TEXT DEFAULT '',
    timezone TEXT DEFAULT 'Europe/Moscow', willing_to_dm BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now());
  CREATE TABLE IF NOT EXISTS games(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL,
    description TEXT DEFAULT '', format TEXT NOT NULL, schedule TEXT DEFAULT '',
    tags TEXT[] DEFAULT '{}', dm_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'recruiting', created_at TIMESTAMPTZ DEFAULT now());
  CREATE TABLE IF NOT EXISTS characters(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, race TEXT DEFAULT 'Human', class TEXT DEFAULT 'Fighter',
    level INT DEFAULT 1, background TEXT DEFAULT '', alignment TEXT DEFAULT '',
    str INT DEFAULT 10, dex INT DEFAULT 10, con INT DEFAULT 10, int INT DEFAULT 10,
    wis INT DEFAULT 10, cha INT DEFAULT 10, hp_max INT DEFAULT 10, hp_current INT DEFAULT 10,
    ac INT DEFAULT 10, initiative INT DEFAULT 0, speed INT DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT now());
  CREATE TABLE IF NOT EXISTS applications(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(game_id,character_id));
  CREATE TABLE IF NOT EXISTS messages(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now());`);
}
function auth(req,res,next){
  try{const h=req.headers.authorization||'';req.user=jwt.verify(h.replace('Bearer ',''),SECRET);next()}
  catch(e){res.status(401).json({errors:[{code:'UNAUTHORIZED',message:'Требуется авторизация'}]})}
}
const ok=(data,res,status=200)=>res.status(status).json({data});

app.get('/api/v1/health',(req,res)=>ok({ok:true},res));

app.post('/api/v1/auth/register',async(req,res)=>{
  try{
    const {email,password,nickname}=req.body;
    if(!email||!password||!nickname)return res.status(400).json({errors:[{code:'VALIDATION_ERROR',message:'Заполните email, пароль и никнейм'}]});
    const hash=await bcrypt.hash(password,12);
    const r=await pool.query('INSERT INTO users(email,password_hash,nickname) VALUES($1,$2,$3) RETURNING id,email,nickname',[email,hash,nickname]);
    ok(r.rows[0],res,201);
  }catch(e){res.status(409).json({errors:[{code:'CONFLICT',message:'Email или никнейм уже используется'}]})}
});
app.post('/api/v1/auth/login',async(req,res)=>{
  const r=await pool.query('SELECT * FROM users WHERE email=$1',[req.body.email]);
  if(!r.rows[0]||!(await bcrypt.compare(req.body.password,r.rows[0].password_hash)))
    return res.status(401).json({errors:[{code:'INVALID_CREDENTIALS',message:'Неверный email или пароль'}]});
  const u=r.rows[0], token=jwt.sign({id:u.id,email:u.email,nickname:u.nickname},SECRET,{expiresIn:'7d'});
  ok({accessToken:token,refreshToken:token,user:{id:u.id,email:u.email,nickname:u.nickname}},res);
});
app.get('/api/v1/users/me',auth,async(req,res)=>{
  const r=await pool.query('SELECT id,email,nickname,bio,timezone,willing_to_dm FROM users WHERE id=$1',[req.user.id]);ok(r.rows[0],res);
});
app.patch('/api/v1/users/me',auth,async(req,res)=>{
  const r=await pool.query('UPDATE users SET bio=COALESCE($1,bio),timezone=COALESCE($2,timezone),willing_to_dm=COALESCE($3,willing_to_dm) WHERE id=$4 RETURNING id,email,nickname,bio,timezone,willing_to_dm',[req.body.bio,req.body.timezone,req.body.willing_to_dm,req.user.id]);ok(r.rows[0],res);
});

app.get('/api/v1/games',async(req,res)=>{
  const q=req.query.search||'',f=req.query.format||'';
  const r=await pool.query(`SELECT g.id,g.title,g.description,g.format,g.schedule,g.tags,g.status,g.created_at,u.nickname AS dm
  FROM games g JOIN users u ON u.id=g.dm_id
  WHERE ($1='' OR g.title ILIKE '%'||$1||'%' OR g.description ILIKE '%'||$1||'%')
  AND ($2='' OR g.format=$2) AND g.status='recruiting' ORDER BY g.created_at DESC`,[q,f]);
  ok(r.rows,res);
});
app.post('/api/v1/games',auth,async(req,res)=>{
  const {title,description='',format='Онлайн',schedule='',tags=[]}=req.body;
  const r=await pool.query('INSERT INTO games(title,description,format,schedule,tags,dm_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[title,description,format,schedule,tags,req.user.id]);
  ok(r.rows[0],res,201);
});
app.get('/api/v1/characters',auth,async(req,res)=>{
  const r=await pool.query('SELECT * FROM characters WHERE user_id=$1 ORDER BY created_at DESC',[req.user.id]);ok(r.rows,res);
});
app.post('/api/v1/characters',auth,async(req,res)=>{
  const c=req.body;
  const r=await pool.query(`INSERT INTO characters(user_id,name,race,class,level,background,alignment,str,dex,con,int,wis,cha,hp_max,hp_current,ac,initiative,speed)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
  [req.user.id,c.name,c.race||'Human',c.class||'Fighter',Number(c.level)||1,c.background||'',c.alignment||'',Number(c.str)||10,Number(c.dex)||10,Number(c.con)||10,Number(c.int)||10,Number(c.wis)||10,Number(c.cha)||10,Number(c.hp_max)||10,Number(c.hp_current)||10,Number(c.ac)||10,Number(c.initiative)||0,Number(c.speed)||30]);
  ok(r.rows[0],res,201);
});
app.post('/api/v1/games/:gameId/applications',auth,async(req,res)=>{
  const own=await pool.query('SELECT id FROM characters WHERE id=$1 AND user_id=$2',[req.body.characterId,req.user.id]);
  if(!own.rows[0])return res.status(403).json({errors:[{code:'FORBIDDEN',message:'Персонаж не принадлежит пользователю'}]});
  const r=await pool.query('INSERT INTO applications(game_id,character_id,user_id) VALUES($1,$2,$3) RETURNING *',[req.params.gameId,req.body.characterId,req.user.id]);ok(r.rows[0],res,201);
});
app.get('/api/v1/games/:gameId/messages',auth,async(req,res)=>{
  const r=await pool.query('SELECT m.id,m.content,m.created_at,u.nickname FROM messages m JOIN users u ON u.id=m.user_id WHERE game_id=$1 ORDER BY m.created_at',[req.params.gameId]);ok(r.rows,res);
});
app.post('/api/v1/games/:gameId/messages',auth,async(req,res)=>{
  const r=await pool.query('INSERT INTO messages(game_id,user_id,content) VALUES($1,$2,$3) RETURNING *',[req.params.gameId,req.user.id,String(req.body.content||'').slice(0,2000)]);
  const msg={...r.rows[0],nickname:req.user.nickname};io.to('game:'+req.params.gameId).emit('chat:new_message',msg);ok(r.rows[0],res,201);
});

io.on('connection',socket=>{
  socket.on('chat:join',({gameId})=>socket.join('game:'+gameId));
  socket.on('chat:leave',({gameId})=>socket.leave('game:'+gameId));
  socket.on('chat:typing',({gameId,nickname})=>socket.to('game:'+gameId).emit('chat:user_typing',{nickname}));
  socket.on('chat:roll',({gameId,dice='1d20'})=>{
    const m=/^(\d+)d(\d+)([+-]\d+)?$/.exec(dice);
    if(!m)return;
    let total=0,rolls=[];for(let i=0;i<Number(m[1]);i++){const x=1+Math.floor(Math.random()*Number(m[2]));rolls.push(x);total+=x}
    total+=Number(m[3]||0);io.to('game:'+gameId).emit('chat:dice_result',{dice,rolls,total});
  });
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'../public/index.html')));

init().then(()=>server.listen(process.env.PORT||10000,'0.0.0.0',()=>console.log('DND Holl started')))
.catch(e=>{console.error(e);process.exit(1)});
