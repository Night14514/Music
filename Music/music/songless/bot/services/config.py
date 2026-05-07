import os
from dataclasses import dataclass


def _required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required env variable: {name}")
    return value


@dataclass(frozen=True)
class Settings:
    bot_token: str
    admin_ids: set[int]
    github_token: str
    github_repo: str
    github_branch: str


def load_settings() -> Settings:
    admins_raw = _required("ADMIN_IDS")
    admin_ids = {int(x.strip()) for x in admins_raw.split(",") if x.strip()}
    return Settings(
        bot_token=_required("BOT_TOKEN"),
        admin_ids=admin_ids,
        github_token=_required("GITHUB_TOKEN"),
        github_repo=_required("GITHUB_REPO"),
        github_branch=os.getenv("GITHUB_BRANCH", "main"),
    )