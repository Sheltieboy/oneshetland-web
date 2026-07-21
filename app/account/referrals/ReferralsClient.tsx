"use client";

import { useEffect, useState } from "react";
import { fetchMyReferrals, applyReferralCode, REFERRAL_REWARD_PENCE, type MyReferrals } from "@/lib/referrals-client";

const ACCENT = "#7c3aed";
const reward = `£${(REFERRAL_REWARD_PENCE / 100).toFixed(0)}`;

const HOW = [
  { icon: "🔗", text: "Share your code with a friend who's new to OneShetland." },
  { icon: "🧾", text: "They enter it and make their first purchase in the app." },
  { icon: "🎁", text: `You each get ${reward} in your OneShetland wallet.` },
];

export function ReferralsClient() {
  const [data, setData] = useState<MyReferrals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try { setData(await fetchMyReferrals()); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load referrals."); }
  }
  useEffect(() => { load(); }, []);

  const shareUrl = "https://oneshetland.netlify.app";
  const shareText = data
    ? `Join me on OneShetland — everything Shetland in one app. Use my code ${data.code} and we'll both get ${reward} to spend locally. ${shareUrl}`
    : "";

  async function share() {
    if (!data) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "OneShetland", text: shareText, url: shareUrl }); return; } catch { /* fall through to copy */ }
    }
    try { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  async function apply() {
    const code = entry.trim();
    if (!code) return;
    setApplying(true); setMsg(null);
    try {
      const res = await applyReferralCode(code);
      if (res.ok) { setMsg({ ok: true, text: `Code applied! Make your first purchase and you'll both get ${reward}.` }); setEntry(""); load(); }
      else setMsg({ ok: false, text: res.error ?? "Please check the code and try again." });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." }); }
    finally { setApplying(false); }
  }

  if (error) return <p className="rounded-card border border-line bg-paper px-4 py-3 text-sm text-rose-600">{error}</p>;

  return (
    <div className="space-y-5">
      {/* Hero + code */}
      <div className="rounded-card p-6 text-paper shadow-soft" style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #4f46e5 60%, #0ea5e9 100%)` }}>
        <h2 className="font-display text-2xl font-bold">Give {reward}, get {reward}</h2>
        <p className="mt-1 max-w-md text-paper/90">
          Share your code. When a friend joins and makes their first purchase, you each get {reward} in your wallet.
        </p>
        <div className="mt-5 rounded-xl bg-paper/15 py-4 text-center backdrop-blur-sm">
          <p className="text-[11px] font-bold tracking-widest text-paper/85">YOUR CODE</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-[0.3em]">{data?.code ?? "—"}</p>
        </div>
        <button onClick={share} className="mt-3 block w-full rounded-pill bg-paper py-2.5 text-sm font-bold text-ink transition hover:brightness-95">
          {copied ? "Invite copied ✓" : "Share your invite"}
        </button>
      </div>

      {/* Stats */}
      {data && data.joined > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-card border border-line bg-paper p-4 text-center shadow-soft">
            <p className="font-display text-2xl font-bold" style={{ color: ACCENT }}>{data.joined}</p>
            <p className="text-xs font-semibold text-ink-muted">{data.joined === 1 ? "friend joined" : "friends joined"}</p>
          </div>
          <div className="rounded-card border border-line bg-paper p-4 text-center shadow-soft">
            <p className="font-display text-2xl font-bold" style={{ color: ACCENT }}>£{(data.earned_pence / 100).toFixed(0)}</p>
            <p className="text-xs font-semibold text-ink-muted">earned so far</p>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <p className="font-display font-bold text-ink">How it works</p>
        <ul className="mt-3 space-y-3">
          {HOW.map((h, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${ACCENT}1a` }}>{h.icon}</span>
              <span className="text-sm text-ink-muted">{h.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Enter a code */}
      <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <p className="font-display font-bold text-ink">Got a friend&apos;s code?</p>
        <div className="mt-3 flex gap-2">
          <input
            value={entry}
            onChange={(e) => setEntry(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            maxLength={12}
            className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 font-bold uppercase tracking-[0.2em] text-ink shadow-soft outline-none placeholder:tracking-normal placeholder:text-ink-faint"
          />
          <button onClick={apply} disabled={applying || !entry.trim()} className="shrink-0 rounded-pill px-6 py-2.5 text-sm font-bold text-paper transition hover:brightness-95 disabled:opacity-50" style={{ background: ACCENT }}>
            {applying ? "…" : "Apply"}
          </button>
        </div>
        {msg && <p className={"mt-2 text-sm font-semibold " + (msg.ok ? "text-emerald-600" : "text-rose-600")}>{msg.text}</p>}
        <p className="mt-2 text-xs text-ink-faint">You can only use a code once, and not your own.</p>
      </div>

      {/* Invite list */}
      {data && data.entries.length > 0 && (
        <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
          <p className="font-display font-bold text-ink">Your invites</p>
          <ul className="mt-3 space-y-2">
            {data.entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold text-ink">{e.name}</span>
                <span
                  className="shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-bold"
                  style={e.status === "rewarded" ? { background: "#d1fae5", color: "#065f46" } : { background: `${ACCENT}1a`, color: ACCENT }}
                >
                  {e.status === "rewarded" ? `+£${(e.reward_pence / 100).toFixed(0)}` : "Pending first purchase"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
