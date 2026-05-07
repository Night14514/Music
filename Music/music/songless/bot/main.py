import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from dotenv import load_dotenv

from bot.handlers.tracks import router as tracks_router
from bot.services.config import load_settings
from bot.services.supabase_service import SupabaseTracksService


async def main() -> None:
    load_dotenv()
    settings = load_settings()

    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()
    dp.include_router(tracks_router)

    tracks_service = SupabaseTracksService(
        url=settings.supabase_url,
        service_role_key=settings.supabase_service_role_key,
        bucket=settings.supabase_bucket,
    )

    await dp.start_polling(
        bot,
        tracks_service=tracks_service,
        hook_url=settings.vercel_deploy_hook_url,
        admin_ids=settings.admin_ids,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())

