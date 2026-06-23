import { getDeliveryRequests, getRuns, getDisputes } from "@/lib/admin-data.server";
import { AdminHeader, Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { DisputesManager } from "@/components/admin/DisputesManager";

export const dynamic = "force-dynamic";

const CAT_ICON: Record<string, string> = { takeaway: "🍕", pharmacy: "💊", parcel: "📦", shop: "🛍️", click_and_collect: "🛒", other: "📫" };

export default async function Page() {
  const [requests, runs, disputes] = await Promise.all([
    getDeliveryRequests() as Promise<{ id: string; category_slug: string; pickup_name: string | null; destination_area: string | null; destination_address: string | null; status: string; total_fee_pence: number | null; created_at: string; customer?: { full_name: string | null } | null }[]>,
    getRuns("open") as Promise<{ id: string; departure_start: string; departure_end: string; status: string; ferry_crossing: boolean; driver?: { full_name: string | null } | null }[]>,
    getDisputes(),
  ]);

  return (
    <>
      <AdminHeader title="Operations" sub="Live view of Fetch deliveries, runs and fee disputes." />

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold text-ink">Open disputes</h2>
        {disputes.length === 0 ? <Empty>No open disputes.</Empty> : <DisputesManager rows={disputes as never[]} />}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold text-ink">Active runs</h2>
        {runs.length === 0 ? <Empty>No active runs.</Empty> : (
          <div className="space-y-2">
            {runs.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{r.driver?.full_name ?? "Driver"} {r.ferry_crossing && <StatusPill label="Ferry" tone="blue" />}</p>
                  <p className="text-sm text-ink-muted">{new Date(r.departure_start).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })} – {new Date(r.departure_end).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <StatusPill label={r.status} tone="green" />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold text-ink">Recent delivery requests</h2>
        {requests.length === 0 ? <Empty>No delivery requests.</Empty> : (
          <div className="space-y-2">
            {requests.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{CAT_ICON[r.category_slug] ?? "📦"} {r.customer?.full_name ?? "Customer"}</p>
                  <p className="truncate text-sm text-ink-muted">{r.pickup_name ?? "—"} → {r.destination_area ?? r.destination_address ?? "—"}</p>
                </div>
                <div className="text-right">
                  <StatusPill label={r.status} tone={r.status === "delivered" ? "green" : r.status === "cancelled" ? "gray" : "amber"} />
                  {r.total_fee_pence != null && <p className="mt-1 text-xs text-ink-faint">£{(r.total_fee_pence / 100).toFixed(2)}</p>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
