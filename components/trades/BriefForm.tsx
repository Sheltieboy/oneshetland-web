"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { PeerieFill } from "@/components/ai/PeerieFill";
import { PEERIE } from "@/lib/peerie";
import { postBrief } from "@/lib/trades-actions";
import {
  SCALES, TRADES, TRADE_LABEL, URGENCIES,
  type Scale, type TradeKey, type Urgency,
} from "@/lib/trades";
import { type TradeMatch } from "@/lib/trades-data";
import { MatchList } from "@/components/trades/MatchList";

/**
 * "Get it done" — describe a job, see who could actually take it on, send it.
 *
 * The live match list is the honest bit and the reason this isn't just a
 * contact form. As soon as we know the trade, we can say "four joiners have
 * room" or "nobody has said they have room" — and the second answer, while
 * disappointing, is the one nobody in Shetland has ever been given. Finding
 * out today beats finding out after three unreturned calls.
 */

const ACCENT = "#2a8b5c";

export function BriefForm({
  signedIn,
  defaultName,
  defaultEmail,
}: {
  signedIn: boolean;
  defaultName: string;
  defaultEmail: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [trades, setTrades] = useState<TradeKey[]>([]);
  const [scale, setScale] = useState<Scale>("unsure");
  const [urgency, setUrgency] = useState<Urgency>("flexible");
  const [locationText, setLocationText] = useState("");
  const [contactName, setContactName] = useState(defaultName);
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState(defaultEmail);

  const [questions, setQuestions] = useState<string[]>([]);
  const [emergencyNote, setEmergencyNote] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const [matches, setMatches] = useState<TradeMatch[] | null>(null);
  const [matching, setMatching] = useState(false);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ id: string; sentTo: number } | null>(null);

  const tradeKey = useMemo(() => trades.slice().sort().join(","), [trades]);

  /* Who could take this on, refreshed as the shape of the job changes. Debounced
     so picking three trades in a row is one query, not three. */
  useEffect(() => {
    if (trades.length === 0) { setMatches(null); return; }
    let alive = true;
    setMatching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/trades/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trades, urgency, scale }),
        });
        const data = await res.json().catch(() => ({}));
        if (alive) setMatches(Array.isArray(data.matches) ? data.matches : []);
      } catch {
        if (alive) setMatches([]);
      } finally {
        if (alive) setMatching(false);
      }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [tradeKey, urgency, scale, trades]);

  function applyPeerie(d: Record<string, unknown>) {
    if (typeof d.title === "string" && d.title) setTitle(d.title);
    if (typeof d.description === "string" && d.description) setDescription(d.description);
    if (Array.isArray(d.trades)) setTrades(d.trades as TradeKey[]);
    if (typeof d.scale === "string") setScale(d.scale as Scale);
    if (typeof d.urgency === "string") setUrgency(d.urgency as Urgency);
    if (typeof d.location === "string" && d.location) setLocationText(d.location);
    setQuestions(Array.isArray(d.questions) ? (d.questions as string[]) : []);
    setEmergencyNote(typeof d.emergency_note === "string" ? d.emergency_note : "");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await postBrief({
        title, description, trades, scale, urgency,
        locationText, contactName, contactPhone, contactEmail,
      });
      if (!res.ok) { setError(res.error ?? "Couldn't post that."); return; }
      setSent({ id: res.id!, sentTo: res.sentTo ?? 0 });
    });
  }

  if (sent) return <Sent sentTo={sent.sentTo} />;

  const pill = (on: boolean) =>
    "rounded-pill border px-3.5 py-1.5 text-sm font-semibold transition " +
    (on ? "border-transparent text-white" : "border-line-strong text-ink-soft hover:bg-sand");

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <form onSubmit={submit} className="space-y-5">
        <PeerieFill
          endpoint="/api/ai/parse-brief"
          accent={ACCENT}
          onBusyChange={setAiBusy}
          instruction="Describe the job the way you'd say it to somebody. I'll sort out which trades it needs and write it up."
          placeholder="e.g. The kitchen window's rotten and won't shut properly. It's a wooden sash, ground floor, in Scalloway. Not urgent but I'd like it done before the winter."
          onFill={applyPeerie}
        />

        {emergencyNote && (
          <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4">
            <p className="font-bold text-rose-800">Before anyone arrives</p>
            <p className="mt-1 text-sm text-rose-800">{emergencyNote}</p>
          </div>
        )}

        <Field label="What needs doing?">
          <input className="auth-input" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Rotten kitchen window, won't close" maxLength={120} required />
        </Field>

        <Field label="Tell them a bit more">
          <textarea className="auth-input min-h-[120px]" value={description}
            onChange={(e) => setDescription(e.target.value)} required
            placeholder="What it is, where it is, anything that would help somebody decide." />
        </Field>

        {questions.length > 0 && (
          <div className="rounded-xl border border-line bg-sand/40 p-4">
            <p className="text-sm font-semibold text-ink">
              {PEERIE.name} reckons they&apos;ll ask you this
            </p>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {questions.map((q, i) => <li key={i}>· {q}</li>)}
            </ul>
            <p className="mt-2 text-xs text-ink-faint">
              Worth adding to the description above — it saves a phone call, and a trade
              can price it without coming out first.
            </p>
          </div>
        )}

        <Field label="Which trade?" hint="Pick everything it needs — one firm covering the lot is often the quickest.">
          <div className="flex flex-wrap gap-2">
            {TRADES.map((t) => {
              const on = trades.includes(t.key);
              return (
                <button key={t.key} type="button" className={pill(on)}
                  style={on ? { background: ACCENT } : undefined}
                  onClick={() => setTrades((p) => on ? p.filter((k) => k !== t.key) : [...p, t.key])}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="How big is it?">
            <div className="flex flex-wrap gap-2">
              {SCALES.map((s) => (
                <button key={s.key} type="button" className={pill(scale === s.key)}
                  style={scale === s.key ? { background: ACCENT } : undefined}
                  onClick={() => setScale(s.key)}>{s.label}</button>
              ))}
            </div>
          </Field>
          <Field label="How soon?">
            <div className="flex flex-wrap gap-2">
              {URGENCIES.map((u) => (
                <button key={u.key} type="button" className={pill(urgency === u.key)}
                  style={urgency === u.key ? { background: ACCENT } : undefined}
                  onClick={() => setUrgency(u.key)}>{u.label}</button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Where is it?">
          <input className="auth-input" value={locationText} onChange={(e) => setLocationText(e.target.value)}
            placeholder="e.g. Scalloway" maxLength={160} required />
        </Field>

        <div className="rounded-xl border border-line bg-paper p-4">
          <p className="font-semibold text-ink">How they get back to you</p>
          <p className="mt-1 text-sm text-ink-muted">
            Only shown to a trade who says they&apos;re interested. It is never in a list
            anyone can browse.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input className="auth-input" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your name" />
            <input className="auth-input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" inputMode="tel" required />
            <input className="auth-input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email (optional)" type="email" />
          </div>
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-4 py-3 font-medium text-rose-700">{error}</p>}

        {signedIn ? (
          <button type="submit" disabled={pending || aiBusy}
            className="w-full rounded-pill px-6 py-3.5 font-bold text-white shadow-soft transition hover:brightness-95 disabled:opacity-60"
            style={{ background: ACCENT }}>
            {pending ? "Sending…" : "Send it to the trades who have room"}
          </button>
        ) : (
          <Link href="/sign-in?next=/get-it-done"
            className="block rounded-pill px-6 py-3.5 text-center font-bold text-white shadow-soft"
            style={{ background: ACCENT }}>
            Sign in to send this
          </Link>
        )}
      </form>

      <aside className="lg:sticky lg:top-24">
        <MatchList matches={matches} loading={matching} trades={trades.map((t) => TRADE_LABEL[t])} />
      </aside>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block font-semibold text-ink">{label}</span>
      {hint && <p className="mb-2 text-sm text-ink-muted">{hint}</p>}
      {children}
    </div>
  );
}

function Sent({ sentTo }: { sentTo: number }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-8 shadow-soft">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl">✅</span>
      <h2 className="mt-5 font-display text-3xl font-bold text-navy">
        {sentTo > 0 ? `Sent to ${sentTo} ${sentTo === 1 ? "trade" : "trades"}` : "Posted"}
      </h2>
      {sentTo > 0 ? (
        <p className="mt-3 text-ink-soft">
          They&apos;ll get your details only if they say they&apos;re interested. You&apos;ll
          hear directly from anyone who is — this isn&apos;t a message thread, they&apos;ll
          just ring you.
        </p>
      ) : (
        /* Worth being straight about. Somebody who has been told "no problem,
           we'll be in touch" and then hears nothing is worse off than somebody
           told the truth today. */
        <p className="mt-3 text-ink-soft">
          Nobody on OneShetland has said they have room for this yet — which is exactly
          the problem we&apos;re trying to fix. Your job is counted in the waiting list,
          and that list is what we use to get more trades signed up. If somebody joins
          who can help, it&apos;ll go to them.
        </p>
      )}
      <Link href="/get-it-done/mine" className="mt-6 inline-block rounded-pill bg-navy px-6 py-3 font-semibold text-paper">
        See your jobs
      </Link>
    </div>
  );
}
