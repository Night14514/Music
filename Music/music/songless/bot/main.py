import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from dotenv import load_dotenv

from bot.handlers.tracks import router as tracks_router
from bot.services.config import load_settings
from bot.services.github_service import GitHubTracksService


async def main() -> None:
    load_dotenv()
    settings = load_settings()

    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()
    dp.include_router(tracks_router)

    tracks_service = GitHubTracksService(
        token=settings.github_token,
        repo=settings.github_repo,
        branch=settings.github_branch,
    )

    await dp.start_polling(
        bot,
        tracks_service=tracks_service,
        admin_ids=settings.admin_ids,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())