import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getHub, hubAccent } from "@/lib/hubs-data";
import { isHubAdmin } from "@/lib/hubs-server";
import { HubForm } from "@/components/hubs/HubForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hub settings" };

export default async function HubSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hub = await getHub(id);
  if (!hub) notFound();
  const admin = await isHubAdmin(hub.id);
  if (!admin.isAdmin) redirect(`/hubs/${hub.slug || hub.id}`);
  const accent = hubAccent(hub);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/hubs/${hub.slug || hub.id}/manage`} className="text-sm font-semibold hover:underline" style={{ color: accent }}>
        ← Back to management
      </Link>
      <h1 className="mt-3 font-display text-3xl font-bold">Hub settings</h1>
      <p className="mt-1 text-ink-soft">Update your hub&apos;s branding, contact details and options.</p>
      <div className="mt-8">
        <HubForm hub={hub} />
      </div>
    </div>
  );
}
