import type { Track } from "@/lib/tracks";

export const SNIPPET_DURATION_SEC = 10;

export type GameMode = "normal" | "daily";

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function formatTime(seconds: number) {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function normalizeGuess(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яё\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCorrectGuess(track: Track, guess: string) {
  const g = normalizeGuess(guess);
  if (!g) return false;
  const title = normalizeGuess(track.title);
  const artist = normalizeGuess(track.artist);
  return g === title || g === artist || g === `${title} ${artist}` || g === `${artist} ${title}`;
}

export function scoreForAnswer(opts: {
  attemptIndex: number; // 0..4
  elapsedSeconds: number;
}) {
  const attemptPenalty = opts.attemptIndex * 15;
  const timePenalty = Math.floor(opts.elapsedSeconds) * 2;
  const raw = 120 - attemptPenalty - timePenalty;
  return clamp(raw, 10, 120);
}

export function hintFor(track: Track, attemptIndex: number) {
  // after 2nd mistake show 1st letters, then more.
  const title = track.title.trim();
  const artist = track.artist.trim();
  const k = attemptIndex >= 3 ? 2 : 1;
  const t = title ? title.slice(0, k) : "";
  const a = artist ? artist.slice(0, k) : "";
  if (!t && !a) return null;
  return `Подсказка: ${t}${t ? "…" : ""} — ${a}${a ? "…" : ""}`;
}

