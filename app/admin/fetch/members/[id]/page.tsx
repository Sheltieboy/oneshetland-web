import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminUI";
import { LoadError } from "@/components/admin/fetch/FetchUI";
import { MemberPanel } from "@/components/admin/fetch/MemberPanel";
import { getFetchMember } from "@/lib/fetch-admin/data.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fetch member" };

/** A member's Fetch counters and restriction. Read-only until an explicit, confirmed action. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const m = await getFetchMember(id);
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/fetch" className="text-ink-muted underline">← Fetch operations</Link></p>
      <AdminHeader title={m.ok ? m.data.name : "Fetch member"} sub="Fetch activity and restriction. Their wider OneShetland account is not changed here." />
      {m.ok ? <MemberPanel member={m.data} /> : <LoadError error={m.error} />}
    </>
  );
}
