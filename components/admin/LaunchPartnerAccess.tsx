"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, StatusPill } from "@/components/admin/AdminUI";
import { useConfirm, useNotify } from "@/components/ui/ConfirmProvider";
import {
  describePlan, dbMessage, expiryBounds, expiryFromDate, tierName,
  GRANT_REASON_MIN, REVOKE_REASON_MIN, type LaunchLookupRow,
} from "@/lib/launch-grant";

export type GrantListRow = {
  grant_id: string; business_id: string; business: string; tier: "pro" | "premium";
  status: "active" | "expired" | "revoked" | "superseded" | "replaced_by_subscription";
  starts_at: string; expires_at: string; reason: string; granted_by_label: string | null;
  created_at: string; revoked_at: string | null; revoke_reason: string | null;
};

const TONE: Record<GrantListRow["status"], "green" | "gray" | "red" | "blue"> = {
  active: "green", expired: "gray", revoked: "red", superseded: "gray", replaced_by_subscription: "blue",
};
const STATUS_LABEL: Record<GrantListRow["status"], string> = {
  active: "active", expired: "ended", revoked: "revoked", superseded: "replaced", replaced_by_subscription: "now a paid subscription",
};
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const input = "w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rose-300";

/**
 * Launch partner access — the admin front for admin_grant_launch_plan / admin_revoke_launch_plan.
 *
 * Every rule (tiers, expiry window, reason, "not a business that pays", audit) lives in the database; this only
 * collects the inputs, identifies the business, asks before acting, and reports what the database said.
 */
export function LaunchPartnerAccess({ grants, initial, initialTier }: { grants: GrantListRow[]; /** A business picked from the claims list, looked up on the server. */ initial?: LaunchLookupRow | null; /** Pre-selects the tier for a launch-partner claim. The grant itself is still an explicit, audited action. */ initialTier?: "pro" | "premium" }) {
  const router = useRouter();
  const confirm = useConfirm();
  const notify = useNotify();
  const [query, setQuery] = useState(initial?.business_id ?? "");
  const [results, setResults] = useState<LaunchLookupRow[] | null>(initial ? [initial] : null);
  const [selected, setSelected] = useState<LaunchLookupRow | null>(initial ?? null);
  const [tier, setTier] = useState<"pro" | "premium">(initialTier ?? "pro");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [busy, setBusy] = useState<"search" | "grant" | "revoke" | null>(null);
  const bounds = expiryBounds();

  async function lookup(q: string): Promise<LaunchLookupRow[]> {
    const { data, error } = await createClient().rpc("admin_launch_business_lookup", { p_query: q });
    if (error) throw error;
    return (data ?? []) as LaunchLookupRow[];
  }

  async function search(q = query) {
    setBusy("search");
    try {
      const rows = await lookup(q);
      setResults(rows);
      if (rows.length === 1) setSelected(rows[0]);
      else setSelected(null);
    } catch (e) { notify({ title: "Couldn't search", body: dbMessage(e), tone: "error" }); }
    finally { setBusy(null); }
  }

  async function reload(id: string) {
    const rows = await lookup(id);
    setSelected(rows[0] ?? null);
    setResults((r) => (r ? r.map((x) => rows.find((y) => y.business_id === x.business_id) ?? x) : r));
    router.refresh();
  }

  async function grant() {
    if (!selected) return;
    const expiresAt = expiryFromDate(date);
    if (!expiresAt) return;
    const ok = await confirm({
      title: "Grant launch partner access?",
      body: `${selected.name}\n${[selected.category, selected.address].filter(Boolean).join(" · ")}\n\n${tierName(tier)} access until ${day(expiresAt)}.\nIncluded free. No Stripe subscription or payment will be created.\n\nReason: ${reason.trim()}`,
      confirmLabel: `Grant ${tierName(tier)}`,
    });
    if (!ok) return;
    setBusy("grant");
    try {
      const { data, error } = await createClient().rpc("admin_grant_launch_plan", {
        p_business_id: selected.business_id, p_tier: tier, p_expires_at: expiresAt, p_reason: reason.trim(),
      });
      if (error) throw error;
      const applied = (data as { applied?: boolean; reason?: string } | null);
      notify({
        title: applied?.applied === false ? "Nothing to change" : "Launch partner access granted",
        body: applied?.applied === false
          ? `${selected.name} already has exactly this access.`
          : `${selected.name} has ${tierName(tier)} access until ${day(expiresAt)}. No payment was taken and no subscription was created.`,
      });
      setReason(""); setDate("");
      await reload(selected.business_id);
    } catch (e) { notify({ title: "Not granted", body: `${dbMessage(e)}\n\nNothing was changed.`, tone: "error" }); }
    finally { setBusy(null); }
  }

  async function revoke(id: string, name: string) {
    const why = revokeReason.trim();
    if (why.length < REVOKE_REASON_MIN) return;
    const ok = await confirm({
      title: "Remove launch partner access?",
      body: `${name} goes back to the Free plan. Offers, products, passes and bookings that need a paid plan stop showing publicly until it has one again.\n\nReason: ${why}`,
      confirmLabel: "Remove access", danger: true,
    });
    if (!ok) return;
    setBusy("revoke");
    try {
      const { data, error } = await createClient().rpc("admin_revoke_launch_plan", { p_business_id: id, p_reason: why });
      if (error) throw error;
      const reasonCode = (data as { reason?: string } | null)?.reason;
      notify({
        title: reasonCode === "no_open_grant" ? "Nothing to remove" : "Launch partner access removed",
        body: reasonCode === "no_open_grant" ? `${name} has no active launch access.`
          : reasonCode === "replaced_by_subscription" ? `${name} now pays for a plan, so its paid plan was left alone.`
          : `${name} is back on the Free plan.`,
      });
      setRevokeReason("");
      await reload(id);
    } catch (e) { notify({ title: "Not removed", body: `${dbMessage(e)}\n\nNothing was changed.`, tone: "error" }); }
    finally { setBusy(null); }
  }

  const plan = selected ? describePlan(selected) : null;
  const grantReady = !!selected && !!plan?.canGrant && !!expiryFromDate(date) && reason.trim().length >= GRANT_REASON_MIN && !busy;

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="font-display text-lg font-bold text-ink">Launch partner access</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Give a real business Pro or Premium free until a date you choose. No Stripe subscription or payment is created, it ends by itself
          on that date, and every grant is recorded. Approve their claim first, so they can sign in and add their own content.
        </p>
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Business name, or paste its id" className={input + " min-w-0 flex-1"} aria-label="Find a business" />
          <button type="submit" disabled={busy === "search" || query.trim().length < 3} className="rounded-pill bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {busy === "search" ? "Searching…" : "Find"}
          </button>
        </form>
        {results && results.length === 0 && <p className="mt-3 text-sm text-ink-muted">No business matches that.</p>}
        {results && results.length > 1 && (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {results.map((r) => (
              <li key={r.business_id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                  <p className="truncate text-xs text-ink-muted">{[r.category, r.address].filter(Boolean).join(" · ")}{r.is_active ? "" : " · inactive"}</p>
                </div>
                <button onClick={() => setSelected(r)} className="shrink-0 rounded-pill border border-line-strong px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-sand">Select</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selected && plan && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-xl font-bold text-ink">{selected.name}</p>
              <p className="text-sm text-ink-muted">{[selected.category, selected.address].filter(Boolean).join(" · ")}</p>
              <p className="mt-0.5 break-all text-xs text-ink-faint">id {selected.business_id}</p>
            </div>
            <div className="flex gap-1.5">
              <StatusPill label={selected.is_active ? "listed" : "inactive"} tone={selected.is_active ? "green" : "gray"} />
              <StatusPill label={selected.is_claimed ? "claimed" : "unclaimed"} tone={selected.is_claimed ? "green" : "amber"} />
            </div>
          </div>

          <div className={"mt-3 rounded-lg px-3 py-2 text-sm " + (plan.kind === "grant" ? "bg-emerald-50 text-emerald-900" : plan.canGrant ? "bg-sand text-ink-soft" : "bg-amber-50 text-amber-900")}>
            <p className="font-semibold">Current plan: {selected.plan_live ? tierName(selected.tier) : "Free"}</p>
            <p>{plan.text}</p>
          </div>

          {!selected.is_claimed && plan.canGrant && (
            <p className="mt-2 text-sm text-amber-800">This listing is unclaimed, so nobody can add offers, products or passes yet. Approve the owner&apos;s claim first.</p>
          )}

          {plan.kind === "grant" && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-sm font-semibold text-ink">Remove launch partner access</p>
              <textarea value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} rows={2} placeholder="Reason (kept in the audit record)" className={input + " mt-2"} />
              <button onClick={() => revoke(selected.business_id, selected.name)} disabled={!!busy || revokeReason.trim().length < REVOKE_REASON_MIN}
                className="mt-2 rounded-pill border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40">
                {busy === "revoke" ? "Removing…" : "Remove access"}
              </button>
            </div>
          )}

          {plan.canGrant && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-sm font-semibold text-ink">{plan.kind === "grant" ? "Change launch partner access" : "Grant launch partner access"}</p>
              <fieldset className="mt-2 grid gap-2 sm:grid-cols-2">
                {([["pro", "Pro", "Offers, and taking bookings"], ["premium", "Premium", "Products and passes (includes Pro)"]] as const).map(([k, label, hint]) => (
                  <label key={k} className={"cursor-pointer rounded-lg border px-3 py-2 text-sm " + (tier === k ? "border-rose-500 bg-rose-50" : "border-line-strong")}>
                    <input type="radio" name="tier" value={k} checked={tier === k} onChange={() => setTier(k)} className="mr-2" />
                    <span className="font-semibold text-ink">{label}</span>
                    <span className="block text-xs text-ink-muted">{hint}</span>
                  </label>
                ))}
              </fieldset>
              <label className="mt-3 block text-sm font-semibold text-ink">
                Free until
                <input type="date" value={date} min={bounds.min} max={bounds.max} onChange={(e) => setDate(e.target.value)} className={input + " mt-1 max-w-xs"} />
              </label>
              <p className="mt-1 text-xs text-ink-muted">Required. Between tomorrow and about two years away. Access ends by itself at the end of that day.</p>
              <label className="mt-3 block text-sm font-semibold text-ink">
                Reason
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Launch partner: first real shop listing" className={input + " mt-1"} />
              </label>
              <p className="mt-1 text-xs text-ink-muted">At least {GRANT_REASON_MIN} characters. Kept in the audit record.</p>
              <button onClick={grant} disabled={!grantReady} className="mt-3 rounded-pill bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">
                {busy === "grant" ? "Granting…" : `Grant ${tierName(tier)} free${date ? ` until ${day(expiryFromDate(date) ?? "")}` : ""}`}
              </button>
              <p className="mt-1.5 text-xs text-ink-muted">Included free. No Stripe subscription or payment will be created.</p>
            </div>
          )}
        </Card>
      )}

      <Card>
        <h3 className="font-display text-base font-bold text-ink">All launch grants</h3>
        {grants.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">None yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {grants.map((g) => (
              <li key={g.grant_id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{g.business} <span className="font-normal text-ink-muted">· {tierName(g.tier)} until {day(g.expires_at)}</span></p>
                  <p className="text-xs text-ink-muted">{g.reason}{g.granted_by_label ? ` · by ${g.granted_by_label.replace(/^admin:/, "admin ")}` : ""}</p>
                  {g.revoke_reason && <p className="text-xs text-ink-muted">Removed: {g.revoke_reason}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill label={STATUS_LABEL[g.status]} tone={TONE[g.status]} />
                  <button onClick={() => { setQuery(g.business_id); void search(g.business_id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="rounded-pill border border-line-strong px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-sand">Open</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
