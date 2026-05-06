"use client";

import Fuse from "fuse.js";
import type { ComponentProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/lib/tracks";
import {
  formatTime,
  GameMode,
  hintFor,
  isCorrectGuess,
  scoreForAnswer,
  SNIPPET_DURATION_SEC,
} from "@/lib/game";

type GameStatus = "loading" | "playing" | "revealed" | "done";
type CatalogItem = { id: number; title: string; artist: string };

function useLocalStorageState<T>(key: string, initial: T) {
  // Important: keep server HTML == first client render to avoid hydration mismatches.
  const [value, setValue] = useState<T>(initial);
  const didLoadRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {}
    didLoadRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!didLoadRef.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function PrimaryButton(props: ComponentProps<"button">) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold",
        "glass transition active:scale-[0.99] hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    />
  );
}

function SecondaryButton(props: ComponentProps<"button">) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold",
        "border border-white/15 bg-white/5 transition hover:bg-white/10 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    />
  );
}

function AttemptBlocks({ wrongCount }: { wrongCount: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cx(
            "h-2.5 w-10 rounded-full border border-white/15",
            i < wrongCount ? "bg-rose-400/70" : "bg-white/5",
          )}
        />
      ))}
    </div>
  );
}

function Progress({
  current,
  total,
  durationSec,
  playedSec,
}: {
  current: number;
  total: number;
  durationSec: number;
  playedSec: number;
}) {
  const pct = durationSec <= 0 ? 0 : Math.min(1, playedSec / durationSec);
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs text-white/70">
        <span>
          Трек {current} / {total}
        </span>
        <span>
          {formatTime(playedSec)} / {formatTime(durationSec)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400/90 to-sky-400/90 transition-[width] duration-100"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useLocalStorageState<GameMode>("songless:mode", "normal");
  const [bundle, setBundle] = useState<{
    mode: GameMode;
    date: string;
    tracks: Track[];
    catalog: CatalogItem[];
  } | null>(null);
  const [status, setStatus] = useState<GameStatus>("loading");
  const [index, setIndex] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [selectedGuess, setSelectedGuess] = useState<CatalogItem | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [input, setInput] = useState("");
  const [activeOption, setActiveOption] = useState(0);
  const [score, setScore] = useLocalStorageState<number>("songless:score", 0);
  const [bestDaily, setBestDaily] = useLocalStorageState<Record<string, number>>(
    "songless:bestDaily",
    {},
  );

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const stopTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playedSec, setPlayedSec] = useState(0);
  const [trackStartedAt, setTrackStartedAt] = useState<number | null>(null);

  const currentTrack = bundle?.tracks[index] ?? null;
  const attemptIndex = Math.min(wrongCount, 4);
  const durationSec = SNIPPET_DURATION_SEC;
  const hint = currentTrack ? hintFor(currentTrack, wrongCount) : null;

  const catalog = bundle?.catalog;
  const fuse = useMemo(() => {
    if (!catalog?.length) return null;
    return new Fuse(catalog, {
      keys: [
        { name: "title", weight: 0.6 },
        { name: "artist", weight: 0.4 },
      ],
      includeScore: true,
      threshold: 0.42,
      ignoreLocation: true,
      useExtendedSearch: false,
      shouldSort: true,
      minMatchCharLength: 1,
    });
  }, [catalog]);

  const options: CatalogItem[] = useMemo(() => {
    const q = input.trim();
    if (!q) return [];
    if (!fuse) return [];
    return fuse
      .search(q)
      .slice(0, 5)
      .map((r) => r.item);
  }, [fuse, input]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetch(`/api/tracks?mode=${mode}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setBundle(data);
        setIndex(0);
        setWrongCount(0);
        setSelectedGuess(null);
        setRevealed(false);
        setInput("");
        setActiveOption(0);
        setStatus("playing");
      })
      .catch(() => {
        if (cancelled) return;
        setBundle({ mode, date: new Date().toISOString().slice(0, 10), tracks: [], catalog: [] });
        setStatus("done");
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      try {
        sourceRef.current?.stop();
      } catch {}
      sourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    setPlayedSec(0);
    setIsPlaying(false);
    setTrackStartedAt(Date.now());
    setSelectedGuess(null);
    setRevealed(false);
    setWrongCount(0);
    setInput("");
    setActiveOption(0);
    stopAudio();
  }, [index]);

  function setShake() {
    setShakeKey((k) => k + 1);
  }

  function stopAudio() {
    try {
      sourceRef.current?.stop();
    } catch {}
    sourceRef.current = null;
    setIsPlaying(false);
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  function startProgressLoop(duration: number, startMs: number) {
    const tick = () => {
      const t = (Date.now() - startMs) / 1000;
      setPlayedSec(Math.min(duration, Math.max(0, t)));
      if (t < duration) {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };
    rafRef.current = window.requestAnimationFrame(tick);
  }

  function getAudioGraph() {
    let ctx = audioCtxRef.current;
    if (!ctx) {
      ctx = new AudioContext();
      audioCtxRef.current = ctx;
    }
    let gain = gainRef.current;
    if (!gain) {
      gain = ctx.createGain();
      gain.gain.value = 1;
      gain.connect(ctx.destination);
      gainRef.current = gain;
    }
    return { ctx, gain };
  }

  async function loadBuffer(filePath: string): Promise<AudioBuffer> {
    const key = filePath;
    const cached = bufferCacheRef.current.get(key);
    if (cached) return cached;

    const res = await fetch(encodeURI(filePath), { cache: "force-cache" });
    if (!res.ok) throw new Error(`Failed to load audio: ${res.status}`);
    const ab = await res.arrayBuffer();
    const { ctx } = getAudioGraph();
    const buf = await ctx.decodeAudioData(ab.slice(0));
    bufferCacheRef.current.set(key, buf);
    return buf;
  }

  async function playSnippet() {
    if (!currentTrack) return;

    stopAudio();
    setPlayedSec(0);

    try {
      const { ctx, gain } = getAudioGraph();
      if (ctx.state === "suspended") await ctx.resume();

      const buf = await loadBuffer(currentTrack.file);
      const maxStart = Math.max(0, buf.duration - durationSec);
      const offset = Math.min(Math.max(0, currentTrack.start), maxStart);

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(gain);
      src.start(0, offset, durationSec);
      sourceRef.current = src;

      src.onended = () => {
        // ensure state is consistent if it ends naturally
        setIsPlaying(false);
      };

      setIsPlaying(true);

      const startMs = Date.now();
      startProgressLoop(durationSec, startMs);

      stopTimerRef.current = window.setTimeout(() => {
        stopAudio();
      }, Math.ceil(durationSec * 1000));
    } catch {
      setIsPlaying(false);
    }
  }

  function revealAnswer() {
    stopAudio();
    setRevealed(true);
    setStatus("revealed");
  }

  function nextTrack() {
    stopAudio();
    if (!bundle) return;
    const next = index + 1;
    if (next >= bundle.tracks.length) {
      setStatus("done");
      return;
    }
    setIndex(next);
    setStatus("playing");
  }

  function onPickGuess(t: CatalogItem) {
    if (!currentTrack) return;
    setSelectedGuess(t);
    setInput(`${t.title} — ${t.artist}`);

    const elapsedSeconds = trackStartedAt ? (Date.now() - trackStartedAt) / 1000 : 0;
    const ok = t.id === currentTrack.id || isCorrectGuess(currentTrack, `${t.title} ${t.artist}`);

    if (ok) {
      stopAudio();
      const earned = scoreForAnswer({ attemptIndex, elapsedSeconds });
      setScore((s) => s + earned);
      if (mode === "daily" && bundle?.date) {
        setBestDaily((prev) => {
          const cur = prev[bundle.date] ?? 0;
          const upd = Math.max(cur, earned);
          return { ...prev, [bundle.date]: upd };
        });
      }
      setStatus("revealed");
      setRevealed(true);
      window.setTimeout(() => nextTrack(), 650);
      return;
    }

    const nextWrong = Math.min(5, wrongCount + 1);
    setWrongCount(nextWrong);
    setShake();
    if (nextWrong >= 5) {
      revealAnswer();
    }
  }

  function onSubmitFreeText() {
    if (!currentTrack) return;
    const q = input.trim();
    if (!q) return;
    if (options.length) {
      const idx = Math.max(0, Math.min(activeOption, options.length - 1));
      onPickGuess(options[idx]!);
      return;
    }

    const elapsedSeconds = trackStartedAt ? (Date.now() - trackStartedAt) / 1000 : 0;
    const ok = isCorrectGuess(currentTrack, q);
    if (ok) {
      stopAudio();
      const earned = scoreForAnswer({ attemptIndex, elapsedSeconds });
      setScore((s) => s + earned);
      setStatus("revealed");
      setRevealed(true);
      window.setTimeout(() => nextTrack(), 650);
      return;
    }

    const nextWrong = Math.min(5, wrongCount + 1);
    setWrongCount(nextWrong);
    setShake();
    if (nextWrong >= 5) revealAnswer();
  }

  function resetRun() {
    setScore(0);
    setIndex(0);
    setWrongCount(0);
    setSelectedGuess(null);
    setRevealed(false);
    setInput("");
    setActiveOption(0);
    setStatus(bundle?.tracks?.length ? "playing" : "done");
  }

  const canPlay = status !== "loading" && !!currentTrack;
  const canSkip = status === "playing" || status === "revealed";
  const showAnswer = revealed && currentTrack;
  const correctFlash = selectedGuess && currentTrack && selectedGuess.id === currentTrack.id;

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold tracking-tight">Songless</div>
            <div className="text-xs text-white/60">
              Локальные mp3 • набор: <span className="font-semibold">{mode.toUpperCase()}</span>
              {bundle?.date ? <span className="ml-2 text-white/40">({bundle.date})</span> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton
              type="button"
              onClick={() => setMode("normal")}
              disabled={mode === "normal"}
              className={cx(mode === "normal" && "bg-white/12")}
            >
              Обычный
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => setMode("daily")}
              disabled={mode === "daily"}
              className={cx(mode === "daily" && "bg-white/12")}
            >
              Daily
            </SecondaryButton>
          </div>
        </header>

        <main className="glass rounded-2xl p-5 md:p-6 shadow-[0_12px_60px_rgba(0,0,0,0.45)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="text-xs text-white/70">
              Автор набора: <span className="font-semibold">Local Tracks</span>
            </div>
            <div className="text-xs text-white/70">
              Очки: <span className="font-semibold text-white">{score}</span>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between gap-4">
            <AttemptBlocks wrongCount={wrongCount} />
            <div className="text-xs text-white/60">
              Попытка: <span className="font-semibold text-white">{attemptIndex + 1}</span> / 5
            </div>
          </div>

          <div
            key={shakeKey}
            className={cx(
              "relative mb-4 rounded-2xl border border-white/15 bg-white/5 p-4",
              wrongCount > 0 && !revealed && "shake",
              correctFlash && "border-emerald-300/40 bg-emerald-300/10",
            )}
          >
            <div className="mb-2 text-xs text-white/60">Название трека или артист</div>

            <div className="relative">
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setActiveOption(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveOption((i) =>
                      options.length ? Math.min(options.length - 1, i + 1) : 0,
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveOption((i) => Math.max(0, i - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    onSubmitFreeText();
                  } else if (e.key === "Escape") {
                    setInput("");
                  }
                }}
                placeholder="Начни вводить… (опечатки ок)"
                className="w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-white/30"
                disabled={status === "loading" || status === "done"}
                autoComplete="off"
              />

              {options.length > 0 ? (
                <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-10 overflow-hidden rounded-xl border border-white/15 bg-black/60 backdrop-blur-xl">
                  {options.map((t, i) => (
                    <button
                      type="button"
                      key={t.id}
                      className={cx(
                        "flex w-full items-center justify-between px-4 py-3 text-left text-sm",
                        "transition hover:bg-white/10",
                        i === activeOption && "bg-white/12",
                      )}
                      onMouseEnter={() => setActiveOption(i)}
                      onClick={() => onPickGuess(t)}
                    >
                      <span className="font-medium text-white/90">{t.title}</span>
                      <span className="text-white/60">{t.artist}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {hint && wrongCount >= 2 && !showAnswer ? (
              <div className="mt-3 text-xs text-white/65">{hint}</div>
            ) : null}

            {showAnswer ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                <div className="text-xs text-white/60 mb-1">Ответ</div>
                <div className="font-semibold text-white">
                  {currentTrack.title} — {currentTrack.artist}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mb-4">
            <Progress
              current={bundle ? index + 1 : 0}
              total={bundle?.tracks.length ?? 0}
              durationSec={durationSec}
              playedSec={playedSec}
            />
          </div>

          <div className="mb-5 flex items-center gap-3">
            <PrimaryButton type="button" onClick={playSnippet} disabled={!canPlay || isPlaying}>
              ▶ Играть ({durationSec}s)
            </PrimaryButton>
            <SecondaryButton type="button" onClick={stopAudio} disabled={!isPlaying}>
              Стоп
            </SecondaryButton>
            <div className="ml-auto flex items-center gap-2">
              <SecondaryButton type="button" onClick={revealAnswer} disabled={!canSkip || revealed}>
                Пропустить
              </SecondaryButton>
              <SecondaryButton type="button" onClick={nextTrack} disabled={!canSkip}>
                Дальше
              </SecondaryButton>
            </div>
          </div>

          {status === "done" ? (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <div className="text-lg font-semibold">Готово!</div>
              <div className="mt-1 text-sm text-white/70">
                Итоговые очки: <span className="font-semibold text-white">{score}</span>
              </div>
              {mode === "daily" && bundle?.date ? (
                <div className="mt-1 text-xs text-white/60">
                  Best daily ({bundle.date}):{" "}
                  <span className="font-semibold text-white">{bestDaily[bundle.date] ?? 0}</span>
                </div>
              ) : null}
              <div className="mt-4 flex gap-2">
                <PrimaryButton type="button" onClick={resetRun}>
                  Сбросить
                </PrimaryButton>
                <SecondaryButton type="button" onClick={() => setMode(mode)}>
                  Играть снова
                </SecondaryButton>
              </div>
            </div>
          ) : null}

        </main>

        <footer className="mt-6 text-center text-xs text-white/45">
          Треки берутся из <span className="font-semibold">/public/tracks</span>. Добавь mp3 и обнови{" "}
          <span className="font-semibold">tracks.json</span>.
        </footer>
      </div>
    </div>
  );
}
