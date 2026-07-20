import { getVesselSubmissions } from "@/lib/admin-data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { VesselSubmissions } from "@/components/admin/VesselSubmissions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const pending = await getVesselSubmissions("pending");

  return (
    <>
      <AdminHeader title="New boats" sub="Community-submitted boats (hulls) awaiting review. Approving creates the vessel in Da Boats." />

      <h2 className="mb-3 font-display text-xl font-bold text-ink">
        Waiting for review
        {pending.length ? <span className="ml-2 rounded-pill bg-rose-600 px-2 py-0.5 align-middle text-sm text-white">{pending.length}</span> : null}
      </h2>
      <p className="mb-5 max-w-2xl text-sm text-ink-muted">
        Each submission is a <strong>hull</strong> — the physical boat. Before approving, check it isn&apos;t already in
        Da Boats under a different name (a renamed boat is the same hull, not a new one). Approving publishes it at
        &ldquo;possible&rdquo; confidence so it reads as unverified until a curator confirms it.
      </p>

      {pending.length === 0
        ? <Empty>No new boats waiting for review.</Empty>
        : <VesselSubmissions rows={pending as never[]} />}
    </>
  );
}
