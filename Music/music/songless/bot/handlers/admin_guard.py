from aiogram.types import Message, CallbackQuery


def is_admin(user_id: int, admin_ids: set[int]) -> bool:
    return user_id in admin_ids


async def deny_message(message: Message) -> None:
    await message.answer("⛔ Доступ запрещен")


async def deny_callback(callback: CallbackQuery) -> None:
    await callback.answer("⛔ Доступ запрещен", show_alert=True)

