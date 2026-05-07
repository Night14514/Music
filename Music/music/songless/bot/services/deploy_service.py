import httpx


async def trigger_redeploy(hook_url: str) -> bool:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(hook_url)
        return 200 <= response.status_code < 300

