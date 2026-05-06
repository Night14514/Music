import { NextResponse } from "next/server";
import { readAllTracks } from "@/lib/tracks";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "normal").toLowerCase();

  const all = await readAllTracks();
  if (all.length === 0) {
    return NextResponse.json(
      {
        mode,
        date: new Date().toISOString().slice(0, 10),
        tracks: [],
        catalog: [],
      },
      { status: 200 },
    );
  }

  const date = new Date().toISOString().slice(0, 10);

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
}

