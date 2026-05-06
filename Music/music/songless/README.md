# Songless (угадай трек) — локальные mp3, без API

Production-ready веб-игра в стиле “songless”: слушаешь короткий отрывок, угадываешь трек/исполнителя, набираешь очки. Все аудио — **локально** в `public/tracks`.

## Стек

- Next.js (App Router)
- Tailwind CSS (v4)
- API routes: `src/app/api/*`
- Fuzzy autocomplete: `Fuse.js`
- Состояние: React state + `localStorage`

## Данные треков

Файл `public/tracks/tracks.json`:

```json
[
  { "id": 1, "title": "Blinding Lights", "artist": "The Weeknd", "file": "/tracks/1.mp3", "start": 12 }
]
```

Положи mp3 в `public/tracks/` и обнови `tracks.json`.

## Логика игры (коротко)

- 7 треков на игру.
- 5 попыток на трек (визуальные блоки).
- Длительность фрагмента: 10s.
- Autocomplete (до 5 вариантов) с fuzzy-поиском по `title` и `artist`, навигация стрелками, `Enter` = выбор.
- Аудио: `<audio>` без контролов, перемотка запрещена, на Play играет ровно `duration`, стартует с `start`.
- Режимы:
  - **Normal**: случайные 7 треков
  - **Daily**: детерминированные 7 треков по дате (одинаковые для всех)

## Запуск локально

```bash
cd songless
npm i
npm run dev
```

Открой `http://localhost:3000`.

## Деплой на Vercel

- Задеплой как обычный Next.js проект.
- Никаких внешних API ключей не нужно.
- Важно: mp3 должны лежать в `public/tracks` внутри проекта.

## Структура

- `public/tracks/tracks.json` — каталог треков
- `src/app/api/tracks/route.ts` — выдача набора треков (Normal/Daily) + каталог для autocomplete
- `src/app/page.tsx` — UI и game loop
- `src/lib/game.ts` — длительности, scoring, нормализация/проверка ответа
- `src/lib/tracks.ts` — чтение `tracks.json` + детерминированная выборка для daily
