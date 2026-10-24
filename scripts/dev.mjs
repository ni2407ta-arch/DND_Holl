/**
 * Один командой поднимает локальную PostgreSQL и сайт:
 *
 *   npm run dev            # http://localhost:3000
 *   PORT=8080 npm run dev  # другой порт
 *
 * Если задан DATABASE_URL (например, от Render), встроенная база не
 * запускается — сервер подключится к указанной базе.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const PORT = process.env.PORT || '3000';
const useExternalDb = Boolean(process.env.DATABASE_URL);
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5433/dndholl';

const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500);
}

function startServer() {
  const server = spawn(process.execPath, [here('./../src/server.js')], {
    env: { ...process.env, DATABASE_URL, PORT },
    stdio: 'inherit',
  });
  children.push(server);
  server.on('exit', (code) => shutdown(code ?? 0));
}

function startDb(done) {
  const db = spawn(process.execPath, [here('./dev-db.mjs')], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(db);

  let ready = false;
  db.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    if (!ready && text.includes('[db] PostgreSQL готов')) {
      ready = true;
      done();
    }
  });
  db.stderr.on('data', (chunk) => process.stderr.write(chunk.toString()));
  db.on('exit', (code) => {
    if (!ready) {
      console.error('[dev] база не запустилась');
      shutdown(code ?? 1);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (useExternalDb) {
  console.log('[dev] используется внешняя база из DATABASE_URL');
  startServer();
} else {
  startDb(startServer);
}
