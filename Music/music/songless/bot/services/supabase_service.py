import random
import re
import uuid
from typing import TypedDict

import httpx


class TrackRow(TypedDict):
    id: int
    title: str
    artist: str
    file: str
    start: int


def parse_artist_title(filename: str) -> tuple[str, str]:
    base = re.sub(r"\.mp3$", "", filename, flags=re.IGNORECASE).strip()
    if " - " in base:
        artist, title = base.split(" - ", 1)
        return artist.strip() or "Unknown", title.strip() or base
    return "Unknown", base


class SupabaseTracksService:
    def __init__(self, url: str, service_role_key: str, bucket: str) -> None:
        self.url = url.rstrip("/")
        self.service_role_key = service_role_key
        self.bucket = bucket
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        }

    def list_tracks(self) -> list[TrackRow]:
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{self.url}/rest/v1/tracks",
                headers=self.headers,
                params={"select": "id,title,artist,file,start", "order": "id.asc"},
            )
            resp.raise_for_status()
            return resp.json() or []

    def add_track(self, original_name: str, content: bytes, mime_type: str = "audio/mpeg") -> TrackRow:
        artist, title = parse_artist_title(original_name)
        ext = ".mp3" if not original_name.lower().endswith(".mp3") else ""
        object_name = f"{uuid.uuid4().hex}_{original_name}{ext}"
        file_url = f"{self.url}/storage/v1/object/public/{self.bucket}/{object_name}"

        with httpx.Client(timeout=60) as client:
            upload_resp = client.post(
                f"{self.url}/storage/v1/object/{self.bucket}/{object_name}",
                headers={
                    **self.headers,
                    "Content-Type": mime_type,
                    "x-upsert": "false",
                },
                content=content,
            )
            upload_resp.raise_for_status()

        payload = {
            "title": title,
            "artist": artist,
            "file": file_url,
            "start": random.randint(10, 20),
        }
        with httpx.Client(timeout=30) as client:
            db_resp = client.post(
                f"{self.url}/rest/v1/tracks",
                headers={**self.headers, "Prefer": "return=representation"},
                json=payload,
            )
            db_resp.raise_for_status()
            return db_resp.json()[0]

    def delete_track(self, track_id: int) -> None:
        with httpx.Client(timeout=30) as client:
            row_resp = client.get(
                f"{self.url}/rest/v1/tracks",
                headers=self.headers,
                params={"select": "id,file", "id": f"eq.{track_id}", "limit": "1"},
            )
            row_resp.raise_for_status()
            row = row_resp.json()
        if not row:
            return

        file_url = row[0]["file"]
        marker = f"/storage/v1/object/public/{self.bucket}/"
        object_name = file_url.split(marker, 1)[1] if marker in file_url else ""
        if object_name:
            with httpx.Client(timeout=30) as client:
                storage_resp = client.delete(
                    f"{self.url}/storage/v1/object/{self.bucket}/{object_name}",
                    headers=self.headers,
                )
                storage_resp.raise_for_status()

        with httpx.Client(timeout=30) as client:
            db_resp = client.delete(
                f"{self.url}/rest/v1/tracks",
                headers=self.headers,
                params={"id": f"eq.{track_id}"},
            )
            db_resp.raise_for_status()

