import base64
import json
import random
import re
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


class GitHubTracksService:
    def __init__(self, token: str, repo: str, branch: str = "main") -> None:
        self.token = token
        self.repo = repo
        self.branch = branch
        self.base_url = f"https://api.github.com/repos/{repo}/contents"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def _get_file(self, path: str) -> tuple[str, str]:
        """Возвращает (content, sha)"""
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{self.base_url}/{path}",
                headers=self.headers,
                params={"ref": self.branch},
            )
            resp.raise_for_status()
            data = resp.json()
            content = base64.b64decode(data["content"]).decode("utf-8")
            return content, data["sha"]

    def _put_file(self, path: str, content: bytes, sha: str | None, message: str) -> None:
        payload: dict = {
            "message": message,
            "content": base64.b64encode(content).encode().decode(),
            "branch": self.branch,
        }
        if sha:
            payload["sha"] = sha
        with httpx.Client(timeout=60) as client:
            resp = client.put(
                f"{self.base_url}/{path}",
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()

    def _delete_file(self, path: str, sha: str, message: str) -> None:
        with httpx.Client(timeout=30) as client:
            resp = client.delete(
                f"{self.base_url}/{path}",
                headers=self.headers,
                json={"message": message, "sha": sha, "branch": self.branch},
            )
            resp.raise_for_status()

    def _read_tracks_json(self) -> tuple[list[TrackRow], str]:
        content, sha = self._get_file("public/tracks/tracks.json")
        return json.loads(content), sha

    def _write_tracks_json(self, tracks: list[TrackRow], sha: str, message: str) -> None:
        content = json.dumps(tracks, ensure_ascii=False, indent=2).encode("utf-8")
        self._put_file("public/tracks/tracks.json", content, sha, message)

    def list_tracks(self) -> list[TrackRow]:
        tracks, _ = self._read_tracks_json()
        return tracks

    def add_track(self, original_name: str, content: bytes) -> TrackRow:
        artist, title = parse_artist_title(original_name)

        # Загружаем mp3 в репозиторий
        mp3_path = f"public/tracks/{original_name}"
        # Проверяем не занято ли имя
        try:
            _, existing_sha = self._get_file(mp3_path)
            # Файл уже есть — добавляем префикс
            import uuid
            original_name = f"{uuid.uuid4().hex[:8]}_{original_name}"
            mp3_path = f"public/tracks/{original_name}"
            existing_sha = None
        except httpx.HTTPStatusError:
            existing_sha = None

        self._put_file(mp3_path, content, existing_sha, f"bot: add track {original_name}")

        # Обновляем tracks.json
        tracks, sha = self._read_tracks_json()
        new_id = max((t["id"] for t in tracks), default=0) + 1
        row: TrackRow = {
            "id": new_id,
            "title": title,
            "artist": artist,
            "file": f"/tracks/{original_name}",
            "start": random.randint(10, 20),
        }
        tracks.append(row)
        self._write_tracks_json(tracks, sha, f"bot: add track {title} — {artist}")
        return row
def delete_track(self, track_id: int) -> None:
        tracks, json_sha = self._read_tracks_json()
        target = next((t for t in tracks if t["id"] == track_id), None)
        if not target:
            return

        # Удаляем mp3
        mp3_name = target["file"].lstrip("/tracks/")
        mp3_path = f"public/tracks/{mp3_name}"
        try:
            _, mp3_sha = self._get_file(mp3_path)
            self._delete_file(mp3_path, mp3_sha, f"bot: delete track {mp3_name}")
        except httpx.HTTPStatusError:
            pass

        # Обновляем tracks.json
        tracks = [t for t in tracks if t["id"] != track_id]
        self._write_tracks_json(tracks, json_sha, f"bot: delete track id={track_id}")
