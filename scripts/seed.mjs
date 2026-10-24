/**
 * Демо-данные для локального запуска: несколько мастеров, игр и персонажей.
 * Ничего не делает, если игры уже есть.
 *
 *   npm run seed
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5433/dndholl';

const pool = new pg.Pool({ connectionString: DATABASE_URL });

const demos = [
  {
    email: 'gm@dndholl.ru',
    nickname: 'Мастер Теней',
    password: 'dndholl123',
    bio: 'Вожу тёмное фэнтези и городские детективы. Ищу игроков на длинную кампанию.',
    willing_to_dm: true,
    games: [
      {
        title: 'Тайны Забытого храма',
        description: 'Классическое подземелье для новичков: факелы, ловушки и один очень подозрительный культист.',
        format: 'Онлайн',
        schedule: 'Суббота, 19:00 МСК',
        tags: ['новичкам', 'dnd5e'],
      },
      {
        title: 'Проклятие Страда',
        description: 'Готический хоррор в Баровии. Ищем двух игроков в состав, 4 уровень.',
        format: 'Онлайн',
        schedule: 'Четверг, 20:00 МСК',
        tags: ['хоррор', 'ролеплей'],
      },
    ],
    characters: [
      { name: 'Ариэль', race: 'Эльф', class: 'Следопыт', level: 3, hp_max: 28, hp_current: 28, ac: 15, initiative: 3 },
    ],
  },
  {
    email: 'kora@dndholl.ru',
    nickname: 'Кора',
    password: 'dndholl123',
    bio: 'Играю за бардов и жрецов, люблю календарь сессий и красивые карты.',
    willing_to_dm: false,
    games: [],
    characters: [
      { name: 'Лиора', race: 'Полуэльф', class: 'Бард', level: 5, hp_max: 38, hp_current: 31, ac: 14, initiative: 4 },
      { name: 'Хельга', race: 'Дварф', class: 'Жрец', level: 2, hp_max: 22, hp_current: 22, ac: 18, initiative: 0 },
    ],
  },
  {
    email: 'borin@dndholl.ru',
    nickname: 'Борин Каменный',
    password: 'dndholl123',
    bio: 'Веду офлайн-игры в Челябинске, кабинет с террейном и миниатюрами.',
    willing_to_dm: true,
    games: [
      {
        title: 'Земли Севера',
        description: 'Хекс-краул по заснеженным пустошам. Офлайн, Челябинск, центр.',
        format: 'Офлайн',
        schedule: 'Воскресенье, 15:00',
        tags: ['хекс-краул', 'офлайн'],
      },
    ],
    characters: [],
  },
];

async function main() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM games');
  if (rows[0].n > 0) {
    console.log(`[seed] в базе уже ${rows[0].n} игр — пропускаю, демо-данные не нужны`);
    return;
  }

  for (const demo of demos) {
    const hash = await bcrypt.hash(demo.password, 12);
    const user = await pool.query(
      `INSERT INTO users(email, password_hash, nickname, bio, willing_to_dm)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [demo.email, hash, demo.nickname, demo.bio, demo.willing_to_dm],
    );
    const userId = user.rows[0].id;

    for (const c of demo.characters) {
      await pool.query(
        `INSERT INTO characters(user_id,name,race,class,level,hp_max,hp_current,ac,initiative)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [userId, c.name, c.race, c.class, c.level, c.hp_max, c.hp_current, c.ac, c.initiative],
      );
    }

    for (const g of demo.games) {
      const game = await pool.query(
        `INSERT INTO games(title,description,format,schedule,tags,dm_id)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [g.title, g.description, g.format, g.schedule, g.tags, userId],
      );
      await pool.query(
        'INSERT INTO messages(game_id,user_id,content) VALUES($1,$2,$3)',
        [game.rows[0].id, userId, `Набор открыт: «${g.title}». Пишите в чат лобби 🎲`],
      );
    }

    console.log(`[seed] создан пользователь ${demo.nickname} (${demo.email} / ${demo.password})`);
  }
}

main()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error('[seed] ошибка:', e);
    await pool.end();
    process.exit(1);
  });
