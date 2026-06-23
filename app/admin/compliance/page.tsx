import { searchCompliance } from "@/lib/admin-data.server";
import { AdminHeader, Card, Empty } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  "email.verified": "Email verified", "terms.accepted": "Terms accepted", "privacy.accepted": "Privacy policy accepted",
  "fetch.liability_ack": "Fetch liability acknowledged", "driver.terms_accepted": "Driver terms accepted",
  "marketing.opted_in": "Marketing opted in", "marketing.opted_out": "Marketing opted out",
  "data.export_requested": "Data export requested", "account.deletion_req": "Account deletion requested",
  "age.confirmed": "Age (16+) confirmed", "booking.terms_accepted": "Booking terms accepted",
  "payment.method_added": "Payment method added", "password.changed": "Password changed", "email.changed": "Email changed",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const rows = email ? await searchCompliance(email) as { id: string; user_name: string | null; user_email: string | null; event_type: string; document_version: string | null; description: string | null; created_at: string }[] : [];

  return (
    <>
      <AdminHeader title="Compliance log" sub="Search a user's immutable record of consents and verifications." />
      <form action="/admin/compliance" method="get" className="mb-6 flex gap-2">
        <input name="email" defaultValue={email ?? ""} placeholder="Search by email address…" className="auth-input flex-1" />
        <button type="submit" className="rounded-pill bg-rose-600 px-5 py-2.5 font-semibold text-white">Search</button>
      </form>

      {!email ? (
        <Empty>Enter an email address to view that user's compliance record.</Empty>
      ) : rows.length === 0 ? (
        <Empty>No records found for “{email}”.</Empty>
      ) : (
        <Card>
          <p className="mb-3 text-sm text-ink-muted">{rows.length} record{rows.length === 1 ? "" : "s"} for <b className="text-ink">{rows[0].user_name ?? rows[0].user_email}</b></p>
          <ol className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{EVENT_LABEL[r.event_type] ?? r.event_type}{r.document_version ? ` · v${r.document_version}` : ""}</p>
                  {r.description && <p className="text-sm text-ink-muted">{r.description}</p>}
                </div>
                <span className="shrink-0 text-xs text-ink-faint">{new Date(r.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </>
  );
}
