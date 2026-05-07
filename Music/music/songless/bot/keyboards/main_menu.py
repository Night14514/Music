from aiogram.types import KeyboardButton, ReplyKeyboardMarkup


def main_menu_kb() -> ReplyKeyboardMarkup:
    # Telegram reply buttons do not support actual color styles.
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📤 Загрузить трек")],
            [KeyboardButton(text="🗑 Удалить трек")],
            [KeyboardButton(text="📃 Список треков")],
        ],
        resize_keyboard=True,
        input_field_placeholder="Выберите действие",
    )

