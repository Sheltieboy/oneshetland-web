"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchMyGiftsReceived, fetchMyGiftsSent,
  type MyGiftReceived, type MyGiftSent,
  fetchMyReadyToClaimGifts, claimGiftById, type ReadyToClaimGift,
  fetchMyPasses, type MyPass,
} from "@/lib/passes-data";

const LOCAL = "#7c3aed";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function GiftRow({ gift, pass }: { gift: MyGiftReceived; pass?: MyPass }) {
  const title = gift.kind === "unit" ? gift.unit_item_name ?? "Gift" : gift.service_name ?? "Booking";
  // A booked gift has nothing left to pick. Derived from the booking row,
  // because book_gifts.status never advances past "claimed" for a service.
  const isBookingPending = gift.kind === "booking" && gift.status === "claimed" && !gift.booked;

  return (
    <li className="rounded-card border border-line bg-paper p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card text-lg" style={{ background: `${LOCAL}1a` }}>
          🎁
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink">{title}</span>
            {gift.status === "used" && (
              /* A unit gift reaches `used` the moment it BECOMES a pass — the
                 value has moved, not been spent. "Used" read as though it were
                 gone. Booking gifts never reach this status (book_gifts stops
                 at "claimed" for a service), so their wording is untouched. */
              <span className="shrink-0 rounded-pill bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                {gift.kind === "unit" ? "Claimed ✓" : "Used"}
              </span>
            )}
            {gift.status !== "used" && gift.booked && (
              <span className="shrink-0 rounded-pill bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">Booked</span>
            )}
          </div>
          {gift.business_name && <p className="text-sm text-ink-muted">{gift.business_name}</p>}
          {gift.purchaser_name && (
            <p className="mt-1 text-sm text-ink-muted">
              From <span className="font-semibold text-ink">{gift.purchaser_name}</span> · claimed {fmtDate(gift.claimed_at)}
            </p>
          )}
          {gift.message && (
            <p className="mt-2 rounded-card bg-sand p-3 text-sm italic text-ink">&ldquo;{gift.message}&rdquo;</p>
          )}

          {gift.kind === "unit" && gift.status === "used" && (
            <p className="mt-2 text-sm text-ink-soft">
              Added to <span className="font-semibold text-ink">My passes</span>
              {pass && typeof pass.uses_remaining === "number"
                ? ` — ${pass.uses_remaining} use${pass.uses_remaining === 1 ? "" : "s"} left`
                : ""}
              {pass?.expires_at ? ` · expires ${fmtDate(pass.expires_at)}` : ""}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="rounded bg-sand px-2 py-1 text-xs font-semibold text-ink-soft">{gift.code}</code>
            {isBookingPending && (
              <Link
                /* The whole point of this task: carry the gifted SERVICE and
                   the GIFT, so the recipient lands in the slot picker for what
                   they were actually given. Linking to the bare business page
                   made them find it all over again. */
                href={`/directory/${gift.business_id}?book=${gift.service_id ?? ""}&gift=${gift.id}`}
                className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper transition hover:brightness-95"
                style={{ background: LOCAL }}
              >
                Pick a time
              </Link>
            )}
            {gift.kind === "unit" && gift.status === "used" && (
              <Link
                href="/account/passes"
                className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper transition hover:brightness-95"
                style={{ background: LOCAL }}
              >
                View pass
              </Link>
            )}
            <Link href={`/g/${gift.code}`} className="text-sm font-semibold underline" style={{ color: LOCAL }}>
              Open gift
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

/* ── A gift I sent ───────────────────────────────────────────────────────────
   Purchase history, not an entitlement. It deliberately carries NO recipient
   action — no Claim, no Pick a time, no Open gift — because buying a gift does
   not make you its recipient. Every status shown here is a real book_gifts
   status; none is invented for presentation.                                  */

const SENT_STATUS: Record<MyGiftSent["status"], { label: string; tone: string }> = {
  sent:      { label: "Waiting to be claimed", tone: "bg-amber-50 text-amber-700" },
  claimed:   { label: "Claimed by recipient",  tone: "bg-sky-50 text-sky-700" },
  used:      { label: "Used",                  tone: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelled",             tone: "bg-rose-50 text-rose-700" },
};

function SentGiftRow({ gift }: { gift: MyGiftSent }) {
  const s = SENT_STATUS[gift.status] ?? { label: gift.status, tone: "bg-sand text-ink-soft" };
  // Self-gift: both facts are true, so it appears in both lists. Saying so is
  // clearer than silently hiding half of somebody's own history.
  const label = gift.claimed_by_me && gift.status !== "sent" ? "Claimed by you" : s.label;

  return (
    <li className="rounded-card border border-line bg-paper p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card text-lg" style={{ background: `${LOCAL}1a` }}>
          🎁
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-ink">{gift.item_name ?? "Gift"}</span>
            <span className={`shrink-0 rounded-pill px-2 py-0.5 text-xs font-bold ${s.tone}`}>{label}</span>
          </div>
          {gift.business_name && <p className="text-sm text-ink-muted">{gift.business_name}</p>}
          <p className="mt-1 text-sm text-ink-muted">
            {gift.recipient_name ? <>To <span className="font-semibold text-ink">{gift.recipient_name}</span> · </> : null}
            sent {fmtDate(gift.created_at)}
            {gift.price_paid_pence > 0 ? ` · £${(gift.price_paid_pence / 100).toFixed(2)}` : ""}
          </p>
          {gift.message && (
            <p className="mt-2 rounded-card bg-sand p-3 text-sm italic text-ink">&ldquo;{gift.message}&rdquo;</p>
          )}
        </div>
      </div>
    </li>
  );
}

export function GiftsClient() {
  const [gifts, setGifts] = useState<MyGiftReceived[] | null>(null);
  const [sent, setSent] = useState<MyGiftSent[] | null>(null);
  // Gifts addressed to this account's confirmed email that have not been
  // claimed. A third relationship to the same table, and the only one the
  // recipient could not see for themselves before claiming.
  const [readyToClaim, setReadyToClaim] = useState<ReadyToClaimGift[] | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [passes, setPasses] = useState<MyPass[]>([]);
  // What was just claimed, so the page can say where the value went rather
  // than silently reshuffling the list.
  const [justClaimed, setJustClaimed] = useState<{ name: string; pass: MyPass | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Received and sent are two different relationships to the same table —
      // claimed_by_user_id vs purchaser_id — so they are two reads, both
      // already permitted by the existing policies.
      const [r, t, u, p] = await Promise.allSettled([
        fetchMyGiftsReceived(), fetchMyGiftsSent(), fetchMyReadyToClaimGifts(), fetchMyPasses(),
      ]);
      if (r.status === "fulfilled") setGifts(r.value);
      else { setGifts([]); setError(r.reason instanceof Error ? r.reason.message : "Could not load your gifts."); }
      if (t.status === "fulfilled") setSent(t.value);
      else { setSent([]); console.error("[gifts] sent lookup failed:", t.reason); }
      if (u.status === "fulfilled") setReadyToClaim(u.value);
      else { setReadyToClaim([]); console.error("[gifts] ready-to-claim lookup failed:", u.reason); }
      // Only to explain where a claimed gift went. A missing pass costs the
      // explanation, never the gift.
      if (p.status === "fulfilled") setPasses(p.value);
      else console.error("[gifts] passes lookup failed:", p.reason);
    })();
  }, []);

  if (gifts === null || sent === null || readyToClaim === null) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-card border border-line bg-sand" />
        ))}
      </div>
    );
  }

  const toClaim = gifts.filter((g) => g.status === "claimed" && !g.booked);
  const ready = gifts.filter((g) => g.status === "claimed" && g.booked);
  const used = gifts.filter((g) => g.status === "used");

  return (
    <div className="space-y-10">
      {error && (
        <p className="rounded-card border border-line bg-paper px-4 py-3 text-sm text-rose-600">{error}</p>
      )}

      {justClaimed && (
        /* A unit gift reaching `used` means it BECAME a pass. Say so, or the
           list simply reshuffles and the customer is left wondering whether
           they have just spent something. */
        <div className="rounded-card border border-emerald-200 bg-emerald-50 p-5 shadow-soft">
          <p className="font-display text-xl font-bold text-emerald-900">Gift claimed!</p>
          <p className="mt-1 text-sm text-emerald-900/85">
            Your <span className="font-semibold">{justClaimed.name}</span> has been added to My passes.
          </p>
          {justClaimed.pass && typeof justClaimed.pass.uses_remaining === "number" && (
            <p className="mt-0.5 text-sm text-emerald-900/85">
              {justClaimed.pass.uses_remaining} use{justClaimed.pass.uses_remaining === 1 ? "" : "s"} available
              {justClaimed.pass.expires_at ? ` · expires ${fmtDate(justClaimed.pass.expires_at)}` : ""}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/account/passes"
              className="rounded-pill px-4 py-2 text-sm font-semibold text-paper"
              style={{ background: LOCAL }}
            >
              View my pass
            </Link>
            <button onClick={() => setJustClaimed(null)} className="text-sm font-semibold text-emerald-900/70 underline">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Gifts received ─────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Gifts received</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Gifts sent to you through OneShetland. Booking gifts wait here until you pick a time.
          </p>
        </div>

        {gifts.length === 0 && readyToClaim.length === 0 ? (
          <div className="rounded-card border border-line bg-paper p-10 text-center shadow-soft">
            <p className="font-display font-bold text-ink">No gifts received yet</p>
            <p className="mt-1 text-sm text-ink-muted">
              When someone sends you a gift through OneShetland, it&apos;ll appear here ready to claim.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {readyToClaim.length > 0 && (
              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-muted">Ready to claim</h3>
                <ul className="space-y-2">
                  {readyToClaim.map((g) => (
                    <li key={g.gift_id} className="rounded-xl border border-line bg-paper p-4 shadow-soft">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display font-bold text-ink">{g.product_name ?? "A gift"}</p>
                          <p className="mt-0.5 text-sm text-ink-soft">
                            {g.sender_name ? `From ${g.sender_name}` : "A gift for you"}
                            {g.business_name ? ` · ${g.business_name}` : ""}
                          </p>
                          {g.message && <p className="mt-1 text-sm italic text-ink-muted">“{g.message}”</p>}
                          <span className="mt-2 inline-block rounded-pill bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            Ready to claim
                          </span>
                        </div>
                        <button
                          onClick={async () => {
                            setClaiming(g.gift_id);
                            setError(null);
                            try {
                              await claimGiftById(g.gift_id);
                              // Re-read rather than moving the card locally: the
                              // claim's outcome is the database's to state.
                              const [again, ready, mine] = await Promise.all([
                                fetchMyGiftsReceived(), fetchMyReadyToClaimGifts(), fetchMyPasses(),
                              ]);
                              setGifts(again);
                              setReadyToClaim(ready);
                              setPasses(mine);
                              // book_unit_purchases.gift_id already carries the
                              // relationship, and it is owner-scoped — no gift
                              // code is involved in resolving it.
                              setJustClaimed({
                                name: g.product_name ?? "Your gift",
                                pass: mine.find((x) => x.gift_id === g.gift_id) ?? null,
                              });
                            } catch (e) {
                              setError(e instanceof Error ? e.message : "Could not claim that gift.");
                            } finally {
                              setClaiming(null);
                            }
                          }}
                          disabled={claiming === g.gift_id}
                          className="shrink-0 rounded-pill px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
                          style={{ background: LOCAL }}
                        >
                          {claiming === g.gift_id ? "Claiming…" : "Claim gift"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {toClaim.length > 0 && (
              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-muted">To claim</h3>
                <ul className="space-y-2">{toClaim.map((g) => <GiftRow key={g.id} gift={g} pass={passes.find((p) => p.gift_id === g.id)} />)}</ul>
              </section>
            )}
            {ready.length > 0 && (
              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-muted">Booked</h3>
                <ul className="space-y-2">{ready.map((g) => <GiftRow key={g.id} gift={g} pass={passes.find((p) => p.gift_id === g.id)} />)}</ul>
              </section>
            )}
            {used.length > 0 && (
              <section>
                {/* "Already used" is where a claimed unit gift lands, and it is
                    the wrong word for it: the gift became a pass that has been
                    spent nothing of. Both kinds here have been claimed, so the
                    heading says that; the row badge still distinguishes them. */}
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-muted">Claimed</h3>
                <ul className="space-y-2">
                  {used.map((g) => <GiftRow key={g.id} gift={g} pass={passes.find((p) => p.gift_id === g.id)} />)}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>

      {/* ── Gifts sent ─────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Gifts sent</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Gifts you&apos;ve bought for somebody else, and how far they&apos;ve got.
          </p>
        </div>

        {sent.length === 0 ? (
          <div className="rounded-card border border-line bg-paper p-10 text-center shadow-soft">
            <p className="font-display font-bold text-ink">No gifts sent yet</p>
            <p className="mt-1 text-sm text-ink-muted">
              You can gift a class, a treatment or a pass from any Shetland business that takes bookings.
            </p>
            <Link href="/directory/bookable" className="mt-4 inline-block rounded-pill bg-navy px-5 py-2 text-sm font-bold text-white">
              Find something to gift
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">{sent.map((g) => <SentGiftRow key={g.id} gift={g} />)}</ul>
        )}
      </div>
    </div>
  );
}
