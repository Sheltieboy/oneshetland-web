"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { MembershipCheckout } from "@/components/hubs/MembershipCheckout";
import { joinHub, leaveHub, rejoinHub } from "@/lib/hubs-client";
import { membershipPrice, isMembershipActive, retainsPaidTime, type HubMembershipType, type HubMember, type JoinMode } from "@/lib/hubs-data";

export function HubMembershipPanel({
  hubId,
  hubName,
  accent,
  joinMode,
  tiers,
  membership,
  isLoggedIn,
  signInHref,
  hasSavedCard = false,
}: {
  hubId: string;
  hubName: string;
  accent: string;
  joinMode: JoinMode;
  tiers: HubMembershipType[];
  membership: HubMember | null;
  isLoggedIn: boolean;
  signInHref: string;
  hasSavedCard?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payTier, setPayTier] = useState<HubMembershipType | null>(null);
  // One reference per deliberate membership checkout — the card route and the
  // wallet route share it, because they are alternatives within one purchase.
  //


  const refresh = () => router.refresh();

  // Renew an existing paid membership — reuses the SAME backend path as joining a
  // paid tier (create-hub-membership-intent → confirm-hub-membership). Prefers an
  // off-session charge on the saved card; falls back to the card-entry modal.

  if (!isLoggedIn) {
    return (
      <Panel accent={accent}>
        <p className="text-ink-soft">Sign in to join {hubName} and see members-only updates.</p>
        <Link href={signInHref} className="mt-3 inline-block rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>
          Sign in to join
        </Link>
      </Panel>
    );
  }

  if (membership && isMembershipActive(membership)) {
    // The paid tier this member is on (if any) — drives renewal pricing.
    const myTier = membership.membership_type_id
      ? tiers.find((t) => t.id === membership.membership_type_id) ?? null
      : null;
    const canRenew = !!myTier && myTier.price_pence > 0;
    return (
      <Panel accent={accent}>
        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        <div className="flex items-center gap-2">
          <span className="rounded-pill px-3 py-1 text-sm font-semibold text-paper" style={{ background: accent }}>
            {membership.role === "owner" ? "Owner" : membership.role === "committee" ? "Committee" : "Member"}
          </span>
          {membership.member_no && <span className="text-sm text-ink-muted">No. {membership.member_no}</span>}
        </div>
        {membership.paid_until && (
          <p className="mt-2 text-sm text-ink-soft">
            {/* Membership does NOT auto-renew. "Renews/expires" implied it did. */}
            Valid until {new Date(membership.paid_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}
        {payTier && (
          <MembershipCheckout
            open={!!payTier}
            onClose={() => setPayTier(null)}
            tier={payTier}
            hubName={hubName}
            accent={accent}
            hasSavedCard={hasSavedCard}
            currentPaidUntil={membership.paid_until}
            isRenewal
          />
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {canRenew && (
            <button
              onClick={() => setPayTier(myTier!)}
              className="rounded-pill px-5 py-2 text-sm font-semibold text-paper transition hover:brightness-95"
              style={{ background: accent }}
            >
              Renew membership
            </button>
          )}
          <button
            onClick={async () => { setBusy(true); try { await leaveHub(hubId); refresh(); } finally { setBusy(false); } }}
            disabled={busy}
            className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand disabled:opacity-50"
          >
            Leave hub
          </button>
        </div>

      </Panel>
    );
  }

  // Left, but the period they paid for is still running. Coming back is theirs
  // already — no checkout, no charge, and the same expiry they had before.
  if (membership && retainsPaidTime(membership)) {
    const backTier = membership.membership_type_id
      ? tiers.find((t) => t.id === membership.membership_type_id) ?? null
      : null;
    return (
      <Panel accent={accent}>
        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        <p className="font-display text-lg font-bold text-ink">You left {hubName}</p>
        <p className="mt-1 text-sm text-ink-soft">
          Your {backTier ? `${backTier.name} ` : ""}membership is still paid up
          {membership.paid_until
            ? ` until ${new Date(membership.paid_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
            : " for life"}
          . Coming back costs nothing.
        </p>
        <button
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const res = await rejoinHub(hubId);
              if (!res.rejoined) throw new Error("That membership can no longer be restored.");
              refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not rejoin.");
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="mt-4 rounded-pill px-5 py-2.5 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50"
          style={{ background: accent }}
        >
          {busy ? "Rejoining…" : "Rejoin — nothing to pay"}
        </button>
        <p className="mt-3 text-xs text-ink-muted">
          Rejoining does not extend your membership or start a new period.
        </p>
      </Panel>
    );
  }

  if (membership && membership.status === "pending") {
    return (
      <Panel accent={accent}>
        <p className="font-semibold text-ink">Request pending</p>
        <p className="mt-1 text-sm text-ink-soft">The committee will review your request to join.</p>
      </Panel>
    );
  }

  // Not a member — join options.
  const freeJoin = async (membershipTypeId?: string) => {
    setBusy(true);
    setError(null);
    try {
      await joinHub(hubId, membershipTypeId);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join.");
    } finally {
      setBusy(false);
    }
  };



  const paidTiers = tiers.filter((t) => t.price_pence > 0);
  const freeTiers = tiers.filter((t) => t.price_pence <= 0);

  return (
    <Panel accent={accent}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      {tiers.length === 0 ? (
        <button onClick={() => freeJoin()} disabled={busy} className="w-full rounded-pill px-5 py-3 font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>
          {busy ? "Joining…" : joinMode === "approval" ? "Request to join" : "Join this hub"}
        </button>
      ) : (
        <div className="space-y-2">
          {/* One action per tier. This used to render a card button AND a wallet
              button for every paid tier — a stack of near-identical pills, each
              labelled with the FACE price while the charge included the fee.
              Choosing how to pay belongs in the checkout, next to the total. */}
          {paidTiers.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-4">
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-ink">{t.name}</p>
                <p className="text-sm text-ink-soft">{membershipPrice(t.price_pence, t.period)}</p>
                {t.description && <p className="mt-0.5 truncate text-xs text-ink-muted">{t.description}</p>}
              </div>
              <button
                onClick={() => setPayTier(t)}
                className="shrink-0 rounded-pill px-5 py-2 text-sm font-semibold text-paper transition hover:brightness-95"
                style={{ background: accent }}
              >
                Join
              </button>
            </div>
          ))}

          {freeTiers.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-4">
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-ink">{t.name}</p>
                <p className="text-sm text-ink-soft">Free</p>
              </div>
              <button
                onClick={() => freeJoin(t.id)}
                disabled={busy}
                className="shrink-0 rounded-pill border border-line-strong px-5 py-2 text-sm font-semibold text-ink transition hover:bg-sand disabled:opacity-50"
              >
                {busy ? "Joining…" : "Join free"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Opening this charges nothing. */}
      {payTier && (
        <MembershipCheckout
          open={!!payTier}
          onClose={() => setPayTier(null)}
          tier={payTier}
          hubName={hubName}
          accent={accent}
          hasSavedCard={hasSavedCard}
          currentPaidUntil={membership?.paid_until ?? null}
          isRenewal={!!membership && isMembershipActive(membership)}
        />
      )}
    </Panel>
  );
}

function Panel({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 bg-paper p-5 shadow-soft" style={{ borderColor: `${accent}33` }}>
      <p className="eyebrow mb-2" style={{ color: accent }}>Membership</p>
      {children}
    </div>
  );
}
