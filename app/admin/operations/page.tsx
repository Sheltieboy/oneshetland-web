import Link from "next/link";
import { getDeliveryRequests, getRuns, getDisputes } from "@/lib/admin-data.server";
import { AdminHeader, Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { DisputesManager } from "@/components/admin/DisputesManager";

export const dynamic = "force-dynamic";

const CAT_ICON: Record<string, string> = { takeaway: "🍕", pharmacy: "💊", parcel: "📦", shop: "🛍️", click_and_collect: "🛒", other: "📫" };

const REQ_FILTERS = ["all", "pending", "accepted", "delivered", "cancelled"] as const;
const RUN_FILTERS = ["all", "open", "completed", "cancelled"] as const;
const DISPUTE_FILTERS = ["open", "resolved", "all"] as const;

type SP = { req?: string; run?: string; disp?: string };

function chipHref(current: SP, key: keyof SP, value: string): string {
  const next = { ...current, [key]: value };
  const sp = new URLSearchParams();
  if (next.req) sp.set("req", next.req);
  if (next.run) sp.set("run", next.run);
  if (next.disp) sp.set("disp", next.disp);
  const qs = sp.toString();
  return "/admin/operations" + (qs ? `?${qs}` : "");
}

function Chips({ current, paramKey, options, active }: { current: SP; paramKey: keyof SP; options: readonly string[]; active: string }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {options.map((o) => (
        <Link
          key={o}
          href={chipHref(current, paramKey, o)}
          className={"rounded-pill px-3.5 py-1.5 text-sm font-semibold capitalize " + (active === o ? "bg-navy text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}
        >
          {o}
        </Link>
      ))}
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const reqFilter = REQ_FILTERS.includes(sp.req as never) ? (sp.req as string) : "all";
  const runFilter = RUN_FILTERS.includes(sp.run as never) ? (sp.run as string) : "open";
  const dispFilter = DISPUTE_FILTERS.includes(sp.disp as never) ? (sp.disp as string) : "open";
  const current: SP = { req: reqFilter === "all" ? undefined : reqFilter, run: runFilter === "open" ? undefined : runFilter, disp: dispFilter === "open" ? undefined : dispFilter };

  const [requests, runs, disputes] = await Promise.all([
    getDeliveryRequests(reqFilter) as Promise<{ id: string; category_slug: string; pickup_name: string | null; destination_area: string | null; destination_address: string | null; status: string; total_fee_pence: number | null; created_at: string; customer?: { full_name: string | null } | null }[]>,
    getRuns(runFilter) as Promise<{ id: string; departure_start: string; departure_end: string; status: string; ferry_crossing: boolean; driver?: { full_name: string | null } | null }[]>,
    getDisputes(dispFilter as "open" | "resolved" | "all"),
  ]);

  return (
    <>
      <AdminHeader title="Operations" sub="Live view of Fetch deliveries, runs and fee disputes." />

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold text-ink">Disputes</h2>
        <Chips current={current} paramKey="disp" options={DISPUTE_FILTERS} active={dispFilter} />
        {disputes.length === 0 ? <Empty>No {dispFilter === "all" ? "" : dispFilter + " "}disputes.</Empty> : <DisputesManager rows={disputes as never[]} />}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold text-ink">Runs</h2>
        <Chips current={current} paramKey="run" options={RUN_FILTERS} active={runFilter} />
        {runs.length === 0 ? <Empty>No {runFilter === "all" ? "" : runFilter + " "}runs.</Empty> : (
          <div className="space-y-2">
            {runs.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{r.driver?.full_name ?? "Driver"} {r.ferry_crossing && <StatusPill label="Ferry" tone="blue" />}</p>
                  <p className="text-sm text-ink-muted">{new Date(r.departure_start).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })} – {new Date(r.departure_end).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <StatusPill label={r.status} tone={r.status === "open" ? "green" : r.status === "cancelled" ? "gray" : "blue"} />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold text-ink">Delivery requests</h2>
        <Chips current={current} paramKey="req" options={REQ_FILTERS} active={reqFilter} />
        {requests.length === 0 ? <Empty>No {reqFilter === "all" ? "" : reqFilter + " "}delivery requests.</Empty> : (
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
