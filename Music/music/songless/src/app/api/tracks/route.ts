import { NextResponse } from "next/server";
import type { Track } from "@/lib/tracks";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "normal").toLowerCase();
  const date = new Date().toISOString().slice(0, 10);

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("tracks")
      .select("id,title,artist,file,start")
      .order("id", { ascending: true });

    if (error) {
      throw error;
    }

    const all: Track[] = (data ?? []).map((row) => ({
      id: Number(row.id),
      title: String(row.title),
      artist: String(row.artist),
      file: String(row.file),
      start: Number(row.start),
    }));

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
  } catch {
    return NextResponse.json(
      {
        mode,
        date,
        tracks: [],
        catalog: [],
        totalTracks: 0,
      },
      { status: 200 },
    );
  }
}

