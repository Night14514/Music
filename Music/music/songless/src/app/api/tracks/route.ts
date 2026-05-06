import { NextResponse } from "next/server";
import {
  hashStringToSeed,
  readAllTracks,
  takeDeterministicSample,
  takeRandomSample,
} from "@/lib/tracks";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "normal").toLowerCase();

  const all = await readAllTracks();
  const count = Math.min(7, all.length);

  if (count === 0) {
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
  const selected =
    mode === "daily"
      ? takeDeterministicSample(all, count, hashStringToSeed(`daily:${date}`))
      : takeRandomSample(all, count);

  return NextResponse.json(
    {
      mode,
      date,
      tracks: selected,
      catalog: all.map((t) => ({ id: t.id, title: t.title, artist: t.artist })),
      totalTracks: all.length,
    },
    { status: 200 },
  );
}

