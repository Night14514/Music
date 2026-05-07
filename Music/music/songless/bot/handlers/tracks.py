from aiogram import F, Router
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message

from bot.handlers.admin_guard import deny_callback, deny_message, is_admin
from bot.keyboards.delete_inline import delete_tracks_kb
from bot.keyboards.main_menu import main_menu_kb
from bot.services.github_service import GitHubTracksService


router = Router()


class UploadTrackState(StatesGroup):
    waiting_audio = State()


def _format_tracks(tracks: list[dict]) -> str:
    if not tracks:
        return "📃 Список треков пуст."
    lines = ["📃 Треки:\n"]
    for t in tracks:
        lines.append(f"{t['id']}. 🎵 {t['artist']} — {t['title']}")
    return "\n".join(lines)


@router.message(Command("start"))
async def on_start(message: Message, state: FSMContext, admin_ids: set[int]) -> None:
    if not message.from_user or not is_admin(message.from_user.id, admin_ids):
        await deny_message(message)
        return
    await state.clear()
    await message.answer(
        "Привет! Это админ-панель треков.\n\n"
        "✅ Загружай mp3\n"
        "🗑 Удаляй треки\n"
        "📃 Смотри каталог",
        reply_markup=main_menu_kb(),
    )


@router.message(F.text == "📤 Загрузить трек")
async def ask_upload(message: Message, state: FSMContext, admin_ids: set[int]) -> None:
    if not message.from_user or not is_admin(message.from_user.id, admin_ids):
        await deny_message(message)
        return
    await state.set_state(UploadTrackState.waiting_audio)
    await message.answer("Отправь mp3-файл 🎧")


@router.message(StateFilter(UploadTrackState.waiting_audio), F.audio | F.document)
async def handle_upload(
    message: Message,
    state: FSMContext,
    tracks_service: GitHubTracksService,
    admin_ids: set[int],
) -> None:
    if not message.from_user or not is_admin(message.from_user.id, admin_ids):
        await deny_message(message)
        return

    media = message.audio or message.document
    if not media:
        await message.answer("❌ Ошибка: отправьте mp3.")
        return

    file_name = media.file_name or "track.mp3"
    if not file_name.lower().endswith(".mp3"):
        await message.answer("❌ Ошибка: нужен именно .mp3 файл.")
        return

    wait_msg = await message.answer("⏳ Загрузка...")
    try:
        file_info = await message.bot.get_file(media.file_id)
        file_bytes = await message.bot.download_file(file_info.file_path)
        content = file_bytes.read()
        row = tracks_service.add_track(file_name, content)
        await wait_msg.edit_text(
            f"✅ Успешно: добавлен трек\n🎵 {row['artist']} — {row['title']}\n\n"
            f"⏳ Vercel задеплоит изменения автоматически (~1 мин)"
        )
    except Exception as exc:
        await wait_msg.edit_text(f"❌ Ошибка: {exc}")
    finally:
        await state.clear()


@router.message(F.text == "📃 Список треков")
async def list_tracks(message: Message, tracks_service: GitHubTracksService, admin_ids: set[int]) -> None:
    if not message.from_user or not is_admin(message.from_user.id, admin_ids):
        await deny_message(message)
        return
    tracks = tracks_service.list_tracks()
    await message.answer(_format_tracks(tracks))


@router.message(F.text == "🗑 Удалить трек")
async def delete_menu(message: Message, tracks_service: GitHubTracksService, admin_ids: set[int]) -> None:
    if not message.from_user or not is_admin(message.from_user.id, admin_ids):
        await deny_message(message)
        return
    tracks = tracks_service.list_tracks()
    if not tracks:
        await message.answer("📃 Нечего удалять — список пуст.")
        return
    await message.answer("Выбери трек для удаления:", reply_markup=delete_tracks_kb(tracks))


@router.callback_query(F.data == "noop")
async def noop(callback: CallbackQuery) -> None:
    await callback.answer()
@router.callback_query(F.data.startswith("delete:"))
async def delete_track(
    callback: CallbackQuery,
    tracks_service: GitHubTracksService,
    admin_ids: set[int],
) -> None:
    if not callback.from_user or not is_admin(callback.from_user.id, admin_ids):
        await deny_callback(callback)
        return

    track_id = int(callback.data.split(":", 1)[1])
    await callback.answer("⏳ Удаляю...")
    try:
        tracks_service.delete_track(track_id)
        await callback.message.answer(
            "✅ Трек удалён\n⏳ Vercel задеплоит изменения автоматически (~1 мин)"
        )
        tracks = tracks_service.list_tracks()
        if callback.message:
            await callback.message.edit_reply_markup(
                reply_markup=delete_tracks_kb(tracks) if tracks else None
            )
    except Exception as exc:
        await callback.message.answer(f"❌ Ошибка: {exc}")
