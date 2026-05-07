# Songless (Next.js + Telegram Admin Bot)

Управление треками вынесено из локальных файлов в внешние сервисы:
- **Storage**: Supabase Storage (bucket `tracks`)
- **DB**: Supabase Postgres (`public.tracks`)
- **Админка**: Telegram bot (aiogram 3)
- **Клиент**: Next.js App Router

`public/tracks/tracks.json` больше не является источником истины.

## Архитектура

- Telegram-бот принимает mp3, загружает в Supabase Storage, создает запись в таблице `tracks`, затем дергает Vercel Deploy Hook.
- Удаление работает обратным путем: бот удаляет объект из storage и запись из БД.
- `GET /api/tracks` в Next.js читает только БД и отдает:
  - `tracks`
  - `catalog`
  - `totalTracks`

## DB схема

SQL лежит в `supabase/schema.sql`.

## ENV

Скопируй `.env.example` в `.env` и заполни:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BOT_TOKEN`
- `ADMIN_IDS` (через запятую)
- `SUPABASE_BUCKET` (по умолчанию `tracks`)
- `VERCEL_DEPLOY_HOOK_URL`

## Запуск web (Next.js)

```bash
cd songless
npm i
npm run dev
```

## Запуск Telegram бота

```bash
cd songless/bot
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m bot.main
```

## Bot UX

- `/start` открывает меню:
  - `📤 Загрузить трек`
  - `🗑 Удалить трек`
  - `📃 Список треков`
- Статусы:
  - `⏳ Загрузка...`
  - `✅ Успешно`
  - `❌ Ошибка`
- Безопасность: whitelist по `ADMIN_IDS`.

## Vercel Deploy Hook

После добавления/удаления бот:
1. отправляет `🚀 Redeploy запущен`
2. вызывает `POST VERCEL_DEPLOY_HOOK_URL`
3. сообщает результат `✅` или `❌`
