# DND Holl — запуск через браузер без Docker и Live Server

Эта версия специально подготовлена для размещения на Render.

## Что это решает

- не нужен Docker;
- не нужен Node.js на компьютере;
- не нужен Live Server;
- сайт работает через обычный HTTPS-адрес;
- один и тот же сайт доступен одновременно с ПК, телефона и планшета;
- данные общие для всех устройств;
- PostgreSQL создаётся на сервере;
- backend и frontend работают как одно приложение;
- есть адаптивная мобильная верстка;
- есть JWT-регистрация/вход;
- есть игры, персонажи, заявки и чат;
- чат поддерживает WebSocket через Socket.IO.

## Локальный запуск (одна команда)

Нужен только Node.js 20+. Системный PostgreSQL не требуется: скрипт поднимает
настоящий PostgreSQL из npm-пакета `embedded-postgres` прямо из `node_modules`.

```bash
npm install
npm run dev        # http://localhost:3000
```

Что происходит:
- `scripts/dev-db.mjs` инициализирует кластер в `/tmp/dnd-holl-pgdata` (порт 5433)
  и создаёт базу `dndholl`;
- `src/server.js` сам создаёт таблицы при первом старте и слушает порт 3000.

Полезные команды:

```bash
npm run seed       # демо-данные: 3 мастера, 3 игры, 3 персонажа
npm run db         # только база, без сайта
npm start          # только сайт (нужен готовый DATABASE_URL)
PORT=8080 npm run dev
```

Демо-аккаунты после `npm run seed` (пароль у всех `dndholl123`):
`gm@dndholl.ru`, `kora@dndholl.ru`, `borin@dndholl.ru`.

Переменные окружения:

| Переменная | По умолчанию | Зачем |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://postgres:postgres@127.0.0.1:5433/dndholl` | строка подключения к PostgreSQL |
| `PORT` | `3000` (`10000` на Render) | порт сайта |
| `JWT_SECRET` | `dev-only-secret` | подпись токенов, на проде задавать обязательно |
| `DND_PGDATA` | `/tmp/dnd-holl-pgdata` | каталог данных встроенной базы |
| `DND_PGPORT` | `5433` | порт встроенной базы |

## Развёртывание

1. Создайте GitHub repository, например `dnd-holl`.
2. Загрузите содержимое этой папки в repository.
3. В Render выберите New → Blueprint.
4. Подключите GitHub и выберите repository.
5. Render найдёт `render.yaml`.
6. Нажмите Deploy Blueprint.
7. Render создаст web service + PostgreSQL.
8. После деплоя сайт будет доступен по адресу вида:
   `https://dnd-holl.onrender.com`

### Собственный домен

В Render:
Service → Settings → Custom Domains → Add Custom Domain.

Например:
`dnd-holl.ru`

После этого Render выдаст DNS-настройки. Их нужно внести у регистратора домена. Render автоматически выдаёт и обновляет TLS-сертификат и переводит HTTP на HTTPS.

## Важно про бесплатный тариф

На бесплатном Render web service может засыпать после периода без активности, поэтому первый запрос после простоя может идти дольше. Для демонстрации курсовой это обычно допустимо.

## Файлы

`public/` — frontend.
`src/server.js` — backend + API + WebSocket.
`scripts/dev.mjs` — запуск базы и сайта одной командой.
`scripts/dev-db.mjs` — локальный PostgreSQL без установки в систему.
`scripts/seed.mjs` — демо-данные.
`render.yaml` — автоматическое создание сервера и PostgreSQL.
