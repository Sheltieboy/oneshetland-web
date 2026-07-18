"use client";

import { GameArt } from "./GameArt";
import type { GameId } from "@/lib/games-data";

/**
 * Shared "start screen" for the games. Replaces each game's bare centred
 * heading-and-button (testers found those "very uninspired") with a proper
 * card: an art medallion on an accent wash, the title, an optional subtitle,
 * a short "how to play" list, a full-width CTA and the guest sign-in note.
 */
export function GameIntro({
  id,
  accent,
  title,
  subtitle,
  description,
  howTo,
  onStart,
  ctaLabel = "Start",
  userId,
  signInPath,
}: {
  id: GameId;
  accent: string;
  title: string;
  subtitle?: string;
  description: string;
  howTo?: string[];
  onStart: () => void;
  ctaLabel?: string;
  userId?: string | null;
  signInPath: string;
}) {
  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-paper p-8 text-center shadow-soft">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28" style={{ background: `linear-gradient(${accent}24, transparent)` }} />
        <div className="relative">
          <div className="mx-auto mb-4 w-fit rounded-3xl p-2" style={{ background: `${accent}18` }}>
            <GameArt id={id} size={72} />
          </div>
          <h2 className="font-display text-3xl font-bold text-ink">{title}</h2>
          {subtitle && <p className="mt-1 text-sm font-semibold" style={{ color: accent }}>{subtitle}</p>}
          <p className="mx-auto mt-3 max-w-sm text-ink-soft">{description}</p>

          {howTo && howTo.length > 0 && (
            <ul className="mx-auto mt-6 flex max-w-xs flex-col gap-2.5 text-left">
              {howTo.map((h, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-ink-soft">
                  <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-paper" style={{ background: accent }}>{i + 1}</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={onStart}
            className="mt-7 w-full rounded-pill px-8 py-3.5 font-semibold text-paper shadow-soft transition hover:brightness-95"
            style={{ background: accent }}
          >
            {ctaLabel}
          </button>
          {!userId && (
            <p className="mt-3 text-xs text-ink-muted">
              Playing as a guest — <a href={`/sign-in?next=${signInPath}`} className="underline">sign in</a> to save scores.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
