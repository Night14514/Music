import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import type { Track } from "@/lib/tracks";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "normal").toLowerCase();
  const date = new Date().toISOString().slice(0, 10);

  try {
    const filePath = join(process.cwd(), "public", "tracks", "tracks.json");
    const raw = readFileSync(filePath, "utf-8");
    const all: Track[] = JSON.parse(raw);

    return NextResponse.json(
      {
        mode,
        date,
        tracks: all,
        catalog: all.map((t) => ({ id: t.id, title: t.title, artist: t.artist })),
        totalTracks: all.length,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to load tracks.json:", err);
    return NextResponse.json(
      { mode, date, tracks: [], catalog: [], totalTracks: 0 },
      { status: 500 },
    );
  }
}