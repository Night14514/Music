import { readFile } from "node:fs/promises";
import path from "node:path";

export type Track = {
  id: number;
  title: string;
  artist: string;
  file: string; // public path, e.g. "/tracks/1.mp3"
  start: number; // seconds
};

export async function readAllTracks(): Promise<Track[]> {
  const jsonPath = path.join(process.cwd(), "public", "tracks", "tracks.json");
  const raw = await readFile(jsonPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];

  const tracks: Track[] = [];
  for (const item of parsed) {
    const obj = item as Record<string, unknown> | null;
    if (
      obj &&
      typeof obj === "object" &&
      typeof obj.id === "number" &&
      typeof obj.title === "string" &&
      typeof obj.artist === "string" &&
      typeof obj.file === "string" &&
      typeof obj.start === "number"
    ) {
      tracks.push(obj as unknown as Track);
    }
  }

  return tracks;
}

export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function takeDeterministicSample<T>(
  items: T[],
  count: number,
  seed: number,
): T[] {
  const arr = items.slice();
  const rnd = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}

export function takeRandomSample<T>(items: T[], count: number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}

