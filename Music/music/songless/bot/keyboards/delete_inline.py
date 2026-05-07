from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


def delete_tracks_kb(tracks: list[dict]) -> InlineKeyboardMarkup:
    rows = []
    for track in tracks:
        title = f"🎵 {track['artist']} - {track['title']}"
        rows.append(
            [
                InlineKeyboardButton(text=title[:64], callback_data="noop"),
                InlineKeyboardButton(text="❌", callback_data=f"delete:{track['id']}"),
            ]
        )
    return InlineKeyboardMarkup(inline_keyboard=rows or [[InlineKeyboardButton(text="Пусто", callback_data="noop")]])

