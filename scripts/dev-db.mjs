/**
 * Локальная PostgreSQL для разработки/демонстрации без установки Postgres в систему.
 *
 * Поднимает настоящий сервер PostgreSQL из npm-пакета `embedded-postgres`
 * (бинарники лежат в node_modules, ничего доустанавливать не нужно).
 *
 * Запуск:  npm run db
 * Переменные окружения:
 *   DND_PGDATA — каталог с данными (по умолчанию /tmp/dnd-holl-pgdata)
 *   DND_PGPORT — порт (по умолчанию 5433)
 *
 * Строка подключения для сервера:
 *   postgres://postgres:postgres@127.0.0.1:5433/dndholl
 */
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const databaseDir = process.env.DND_PGDATA || '/tmp/dnd-holl-pgdata';
const port = Number(process.env.DND_PGPORT || 5433);
const user = 'postgres';
const password = 'postgres';
const database = 'dndholl';

fs.mkdirSync(databaseDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir,
  port,
  user,
  password,
  persistent: true,
  authMethod: 'password',
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: (msg) => process.stdout.write(`[pg] ${msg}\n`),
  onError: (err) => process.stderr.write(`[pg:err] ${err instanceof Error ? err.stack : err}\n`),
});

const isInitialised = fs.existsSync(path.join(databaseDir, 'PG_VERSION'));

async function main() {
  if (!isInitialised) {
    console.log(`[db] первый запуск, инициализирую кластер в ${databaseDir}`);
    await pg.initialise();
  }
  await pg.start();

  // Кластер мог быть создан раньше, поэтому проверяем наличие базы при каждом старте.
  const client = pg.getPgClient('postgres');
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (!rowCount) {
      await pg.createDatabase(database);
      console.log(`[db] база "${database}" создана`);
    }
  } finally {
    await client.end();
  }
  console.log(`[db] PostgreSQL готов: postgres://${user}:${password}@127.0.0.1:${port}/${database}`);
}

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[db] получен ${signal}, останавливаю PostgreSQL…`);
  try {
    await pg.stop();
  } catch (e) {
    console.error('[db] ошибка остановки:', e);
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((e) => {
  console.error('[db] не удалось запустить PostgreSQL:', e);
  process.exit(1);
});
