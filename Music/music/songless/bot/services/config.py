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
    supabase_url: str
    supabase_service_role_key: str
    supabase_bucket: str
    vercel_deploy_hook_url: str


def load_settings() -> Settings:
    admins_raw = _required("ADMIN_IDS")
    admin_ids = {int(x.strip()) for x in admins_raw.split(",") if x.strip()}
    return Settings(
        bot_token=_required("BOT_TOKEN"),
        admin_ids=admin_ids,
        supabase_url=_required("SUPABASE_URL"),
        supabase_service_role_key=_required("SUPABASE_SERVICE_ROLE_KEY"),
        supabase_bucket=os.getenv("SUPABASE_BUCKET", "tracks"),
        vercel_deploy_hook_url=_required("VERCEL_DEPLOY_HOOK_URL"),
    )

