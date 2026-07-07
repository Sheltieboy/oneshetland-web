"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getDailyWird, maxTries, checkGuess, buildKeyMap, buildClues, isValidGuess, calcScore,
  recordResult, loadStats, loadDailyState, saveDailyState, buildShareText, todayKey,
  type DailyWird, type GuessRow, type LetterState, type ClueLevel, type DailyStats,
} from "@/lib/guess-da-wird";
import { submitScore } from "@/lib/games-score";
import { Rain, Burst } from "@/components/games/Confetti";

const STATE_COLOR: Record<LetterState, { bg: string; fg: string; bd: string }> = {
  anchored: { bg: "#12B3D6", fg: "#fff", bd: "#12B3D6" },
  drifting: { bg: "#D97706", fg: "#fff", bd: "#D97706" },
  away: { bg: "#475569", fg: "#fff", bd: "#475569" },
  empty: { bg: "transparent", fg: "var(--color-ink)", bd: "var(--color-line-strong)" },
};
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const ACCENT = "#1D4ED8";

export function GuessDaWird({ userId }: { userId: string | null }) {
  const uid = userId ?? "guest";
  const [wird, setWird] = useState<DailyWird | null>(null);
  const [rows, setRows] = useState<GuessRow[]>([]);
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [cluesShown, setCluesShown] = useState<ClueLevel>(1);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  // Holds the last winning-score payload so a failed save can be retried.
  const pendingSave = useRef<{ score: number; metadata: Record<string, unknown> } | null>(null);

  // Load daily word + restore saved state
  useEffect(() => {
    let alive = true;
    (async () => {
      const w = await getDailyWird(todayKey());
      if (!alive) return;
      setWird(w);
      const saved = loadDailyState(uid);
      if (saved && saved.dateKey === todayKey()) {
        setRows(saved.guesses.map((g) => ({ word: g, letters: checkGuess(g, w.word) })));
        setCluesShown(saved.cluesShown);
        setStatus(saved.won ? "won" : saved.lost ? "lost" : "playing");
      }
      setStats(loadStats(uid));
    })();
    return () => { alive = false; };
  }, [uid]);

  const finish = useCallback((guesses: GuessRow[], won: boolean) => {
    if (!wird) return;
    const cluesUsed = cluesShown - 1;
    const tries = guesses.length;
    const updated = recordResult(uid, wird.date_key, tries, won, cluesUsed);
    setStats(updated);
    setStatus(won ? "won" : "lost");
    saveDailyState(uid, { dateKey: wird.date_key, guesses: guesses.map((g) => g.word), won, lost: !won, cluesShown });
    if (userId && won) {
      const score = calcScore(tries, maxTries(wird.word), cluesUsed, won, wird.difficulty);
      const metadata = { date: wird.date_key, tries, won, cluesUsed, difficulty: wird.difficulty };
      pendingSave.current = { score, metadata };
      setSaving(true);
      setSaveError(false);
      submitScore(userId, "guess_da_wird", score, { metadata, xpEarned: score })
        .then(() => { pendingSave.current = null; })
        .catch((e) => { console.error("Score submit failed", e); setSaveError(true); })
        .finally(() => setSaving(false));
    }
  }, [wird, cluesShown, uid, userId]);

  const retrySave = useCallback(() => {
    if (!userId || !pendingSave.current || saving) return;
    const { score, metadata } = pendingSave.current;
    setSaving(true);
    setSaveError(false);
    submitScore(userId, "guess_da_wird", score, { metadata, xpEarned: score })
      .then(() => { pendingSave.current = null; })
      .catch((e) => { console.error("Score submit retry failed", e); setSaveError(true); })
      .finally(() => setSaving(false));
  }, [userId, saving]);

  const submit = useCallback(async () => {
    if (!wird || status !== "playing") return;
    const len = wird.word.length;
    if (current.length !== len) { setError(`Wird is ${len} letters`); return; }
    const ok = await isValidGuess(current, len);
    if (!ok) { setError("Not a Shetland wird we ken"); return; }
    setError(null);
    const row: GuessRow = { word: current.toLowerCase(), letters: checkGuess(current, wird.word) };
    const newRows = [...rows, row];
    setRows(newRows);
    setCurrent("");
    const won = current.toLowerCase() === wird.word.toLowerCase();
    const lost = !won && newRows.length >= maxTries(wird.word);
    if (won || lost) finish(newRows, won);
    else saveDailyState(uid, { dateKey: wird.date_key, guesses: newRows.map((g) => g.word), won: false, lost: false, cluesShown });
  }, [wird, current, rows, status, finish, cluesShown, uid]);

  const onKey = useCallback((k: string) => {
    if (!wird || status !== "playing") return;
    setError(null);
    if (k === "ENTER") { submit(); return; }
    if (k === "DEL") { setCurrent((c) => c.slice(0, -1)); return; }
    if (/^[a-z]$/.test(k) && current.length < wird.word.length) setCurrent((c) => c + k);
  }, [wird, status, current, submit]);

  // Physical keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") onKey("ENTER");
      else if (e.key === "Backspace") onKey("DEL");
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toLowerCase());
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onKey]);

  if (!wird) return <div className="mx-auto max-w-md px-5 py-16 text-center text-ink-muted">Loading today's wird…</div>;

  const len = wird.word.length;
  const tries = maxTries(wird.word);
  const keyMap = buildKeyMap(rows);
  const clues = buildClues(wird);
  const done = status !== "playing";

  async function share() {
    const txt = buildShareText(wird!.date_key, rows, status === "won", cluesShown - 1, stats?.currentStreak ?? 0);
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      {/* Intro pills */}
      {rows.length === 0 && status === "playing" && (
        <div className="mb-5 flex flex-wrap justify-center gap-2 text-center">
          <Pill>{len} letters</Pill><Pill>{tries} tries</Pill><Pill>{["", "Easy", "Medium", "Hard"][wird.difficulty]}</Pill>
        </div>
      )}

      {/* Board */}
      <div className="mx-auto flex flex-col items-center gap-1.5">
        {Array.from({ length: tries }).map((_, r) => {
          const row = rows[r];
          const isCurrent = r === rows.length && status === "playing";
          return (
            <div key={r} className="flex gap-1.5">
              {Array.from({ length: len }).map((_, c) => {
                const lr = row?.letters[c];
                const ch = lr ? lr.letter : isCurrent ? current[c] ?? "" : "";
                const col = lr ? STATE_COLOR[lr.state] : STATE_COLOR.empty;
                return (
                  <div key={c} className="flex h-12 w-12 items-center justify-center rounded-md border-2 font-display text-xl font-bold uppercase"
                    style={{ background: col.bg, color: col.fg, borderColor: col.bd }}>{ch}</div>
                );
              })}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-center text-sm font-semibold text-rose-600">{error}</p>}

      <Rain show={status === "won"} />

      {/* Result */}
      {done && (
        <div className="mt-5 rounded-card border border-line bg-paper p-5 text-center shadow-soft">
          <p className="font-display text-xl font-bold" style={{ color: status === "won" ? ACCENT : "var(--color-ink)" }}>
            {status === "won" ? "Weel done!" : "Kept its secret"}
          </p>
          <p className="mt-1 text-ink-soft">The wird was <b className="uppercase">{wird.word}</b></p>
          {stats && <p className="mt-2 text-sm text-ink-muted">🔥 Streak {stats.currentStreak} · Played {stats.played} · Won {stats.won}</p>}
          {userId && status === "won" && saveError && (
            <div className="mx-auto mt-3 max-w-xs rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="font-semibold">Couldn&apos;t save today&apos;s result.</p>
              <p className="mt-0.5 text-rose-600">It won&apos;t count on the leaderboard until it saves.</p>
              <button onClick={retrySave} disabled={saving} className="mt-2 rounded-pill bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-60">{saving ? "Saving…" : "Retry"}</button>
            </div>
          )}
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={share} className="rounded-pill px-5 py-2.5 text-sm font-semibold text-paper hover:brightness-95" style={{ background: ACCENT }}>{copied ? "Copied!" : "Share result"}</button>
            <Link href={`/spik/${wird.id}`} className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">See definition</Link>
          </div>
          <Link href="/games" className="mt-3 inline-block text-xs font-semibold text-ink-muted hover:text-ink">← Back to games</Link>
        </div>
      )}

      {/* Clues */}
      {!done && (
        <div className="mt-5 space-y-2">
          {clues.slice(0, cluesShown).map((cl) => (
            <div key={cl.level} className="rounded-card border border-line bg-paper px-4 py-2.5 text-sm shadow-soft">
              <span className="font-semibold text-ink">Clue {cl.level}:</span> <span className="text-ink-soft">{cl.content}</span>
            </div>
          ))}
          {cluesShown < 5 && (
            <button onClick={() => setCluesShown((c) => (Math.min(5, c + 1) as ClueLevel))} className="w-full rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">
              {clues[cluesShown]?.label ?? "Another clue"} →
            </button>
          )}
        </div>
      )}

      {/* Keyboard */}
      {!done && (
        <div className="mt-6 select-none space-y-1.5">
          {KEY_ROWS.map((rowStr, ri) => (
            <div key={ri} className="flex justify-center gap-1.5">
              {ri === 2 && <KeyBtn label="ENTER" wide onClick={() => onKey("ENTER")} />}
              {rowStr.split("").map((k) => {
                const st = keyMap[k];
                const col = st ? STATE_COLOR[st] : null;
                return (
                  <button key={k} onClick={() => onKey(k)} className="h-12 min-w-[8.5%] flex-1 rounded-md text-sm font-bold uppercase transition"
                    style={col ? { background: col.bg, color: col.fg } : { background: "var(--color-sand)", color: "var(--color-ink)" }}>{k}</button>
                );
              })}
              {ri === 2 && <KeyBtn label="⌫" wide onClick={() => onKey("DEL")} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KeyBtn({ label, wide, onClick }: { label: string; wide?: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={"h-12 rounded-md bg-sand px-2 text-xs font-bold text-ink " + (wide ? "min-w-[14%]" : "")}>{label}</button>;
}
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-pill bg-sand px-3 py-1 text-sm font-semibold text-ink-soft">{children}</span>;
}
