import json
import os
import random
import re
import uuid
from pathlib import Path
from typing import TypedDict


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


class LocalTracksService:
    def __init__(self, tracks_dir: str) -> None:
        self.tracks_dir = Path(tracks_dir)
        self.json_path = self.tracks_dir / "tracks.json"

    def _read(self) -> list[TrackRow]:
        if not self.json_path.exists():
            return []
        with open(self.json_path, encoding="utf-8") as f:
            return json.load(f)

    def _write(self, tracks: list[TrackRow]) -> None:
        with open(self.json_path, "w", encoding="utf-8") as f:
            json.dump(tracks, f, ensure_ascii=False, indent=2)

    def list_tracks(self) -> list[TrackRow]:
        return self._read()

    def add_track(self, original_name: str, content: bytes) -> TrackRow:
        artist, title = parse_artist_title(original_name)
        safe_name = original_name
        dest = self.tracks_dir / safe_name
        if dest.exists():
            safe_name = f"{uuid.uuid4().hex[:8]}_{original_name}"
            dest = self.tracks_dir / safe_name
        dest.write_bytes(content)

        tracks = self._read()
        new_id = max((t["id"] for t in tracks), default=0) + 1
        row: TrackRow = {
            "id": new_id,
            "title": title,
            "artist": artist,
            "file": f"/tracks/{safe_name}",
            "start": random.randint(10, 20),
        }
        tracks.append(row)
        self._write(tracks)
        return row

    def delete_track(self, track_id: int) -> None:
        tracks = self._read()
        target = next((t for t in tracks if t["id"] == track_id), None)
        if not target:
            return

        file_path = self.tracks_dir / os.path.basename(target["file"])
        if file_path.exists():
            file_path.unlink()

        tracks = [t for t in tracks if t["id"] != track_id]
        self._write(tracks)