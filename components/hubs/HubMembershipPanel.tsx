"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { joinHub, leaveHub, startMembershipPayment, confirmMembership } from "@/lib/hubs-client";
import { membershipPrice, isMembershipActive, type HubMembershipType, type HubMember, type JoinMode } from "@/lib/hubs-data";

export function HubMembershipPanel({
  hubId,
  hubName,
  accent,
  joinMode,
  tiers,
  membership,
  isLoggedIn,
  signInHref,
}: {
  hubId: string;
  hubName: string;
  accent: string;
  joinMode: JoinMode;
  tiers: HubMembershipType[];
  membership: HubMember | null;
  isLoggedIn: boolean;
  signInHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payTier, setPayTier] = useState<HubMembershipType | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  const refresh = () => router.refresh();

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
    return (
      <Panel accent={accent}>
        <div className="flex items-center gap-2">
          <span className="rounded-pill px-3 py-1 text-sm font-semibold text-paper" style={{ background: accent }}>
            {membership.role === "owner" ? "Owner" : membership.role === "committee" ? "Committee" : "Member"}
          </span>
          {membership.member_no && <span className="text-sm text-ink-muted">No. {membership.member_no}</span>}
        </div>
        {membership.paid_until && (
          <p className="mt-2 text-sm text-ink-soft">
            Renews/expires {new Date(membership.paid_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}
        <button
          onClick={async () => { setBusy(true); try { await leaveHub(hubId); refresh(); } finally { setBusy(false); } }}
          disabled={busy}
          className="mt-4 rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand disabled:opacity-50"
        >
          Leave hub
        </button>
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

  const startPaid = async (tier: HubMembershipType) => {
    setBusy(true);
    setError(null);
    try {
      const res = await startMembershipPayment(tier.id);
      if (res.charged) {
        await confirmMembership(res.payment_intent_id);
        refresh();
        return;
      }
      if (res.clientSecret) {
        setPayTier(tier);
        setClientSecret(res.clientSecret);
        setPaymentIntentId(res.payment_intent_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start payment.");
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
          {freeTiers.map((t) => (
            <button key={t.id} onClick={() => freeJoin(t.id)} disabled={busy}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-paper px-4 py-3 text-left font-semibold transition hover:border-current disabled:opacity-50"
              style={{ color: accent }}>
              <span className="text-ink">{t.name}</span>
              <span>Free · Join</span>
            </button>
          ))}
          {paidTiers.map((t) => (
            <button key={t.id} onClick={() => startPaid(t)} disabled={busy}
              className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left font-semibold text-paper transition hover:brightness-95 disabled:opacity-50"
              style={{ background: accent }}>
              <span>{t.name}</span>
              <span>{membershipPrice(t.price_pence, t.period)}</span>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={!!(payTier && clientSecret)}
        onClose={() => { setPayTier(null); setClientSecret(null); }}
        title={`Join — ${payTier?.name ?? ""}`}
        subtitle={payTier ? membershipPrice(payTier.price_pence, payTier.period) : undefined}
        accent={accent}
      >
        {payTier && clientSecret && paymentIntentId && (
          <PaymentCheckout
            clientSecret={clientSecret}
            amountPence={payTier.price_pence}
            accent={accent}
            payLabel={`Pay ${membershipPrice(payTier.price_pence, payTier.period)}`}
            onPaid={async () => { await confirmMembership(paymentIntentId); router.refresh(); }}
            onCancel={() => { setPayTier(null); setClientSecret(null); }}
          />
        )}
      </Modal>
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
