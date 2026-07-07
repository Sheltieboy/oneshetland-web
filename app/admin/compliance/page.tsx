import { searchCompliance } from "@/lib/admin-data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { ComplianceList, type ComplianceRow } from "@/components/admin/ComplianceList";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const rows = email ? (await searchCompliance(email)) as ComplianceRow[] : [];

  return (
    <>
      <AdminHeader title="Compliance log" sub="Search a user's immutable record of consents and verifications. Tap a row for IP, device and version detail." />
      <form action="/admin/compliance" method="get" className="mb-6 flex gap-2">
        <input name="email" defaultValue={email ?? ""} placeholder="Search by email address…" className="auth-input flex-1" />
        <button type="submit" className="rounded-pill bg-rose-600 px-5 py-2.5 font-semibold text-white">Search</button>
      </form>

      {!email ? (
        <Empty>Enter an email address to view that user's compliance record.</Empty>
      ) : rows.length === 0 ? (
        <Empty>No records found for &ldquo;{email}&rdquo;.</Empty>
      ) : (
        <ComplianceList rows={rows} />
      )}
    </>
  );
}
