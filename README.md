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
`render.yaml` — автоматическое создание сервера и PostgreSQL.
