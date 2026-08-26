import { Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { gbp } from "@/lib/stripe";
import type { AdminBoostPurchase } from "@/lib/admin-data.server";

/**
 * Business boosts, for support and disputes.
 *
 * Read-only. There is no refund control here yet — refunding a boost does not
 * currently revoke it, so offering the button would imply something the system
 * does not do.
 */
const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function BoostPurchases({ purchases }: { purchases: AdminBoostPurchase[] }) {
  const paid = purchases.filter((p) => p.status === "succeeded");
  const total = paid.reduce((sum, p) => sum + p.amount_pence, 0);

  return (
    <section className="mt-10">
      <h2 className="mb-1 font-display text-xl font-bold text-ink">Business boosts</h2>
      <p className="mb-3 text-sm text-ink-soft">
        {paid.length} paid {paid.length === 1 ? "boost" : "boosts"} · {gbp(total)} to OneShetland.
      </p>

      {purchases.length === 0 ? (
        <Card><Empty>No boosts bought yet.</Empty></Card>
      ) : (
        <div className="space-y-2">
          {purchases.map((p) => {
            const active = p.status === "succeeded" && !!p.expires_at && new Date(p.expires_at) > new Date();
            return (
              <Card key={p.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-ink">{p.businessName}</p>
                    <p className="text-sm text-ink-soft">
                      {p.weeks} week{p.weeks > 1 ? "s" : ""} of Pro · bought by {p.ownerName}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {fmt(p.created_at)}
                      {p.expires_at ? ` · Pro until ${fmt(p.expires_at)}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg font-bold text-ink">{gbp(p.amount_pence)}</p>
                    <div className="mt-1 flex justify-end">
                      <StatusPill
                        label={p.status !== "succeeded" ? "Pending" : active ? "Active" : "Expired"}
                        tone={p.status !== "succeeded" ? "amber" : active ? "green" : "gray"}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
