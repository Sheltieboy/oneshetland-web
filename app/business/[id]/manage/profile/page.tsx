import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { ProfileManager } from "@/components/business/ProfileManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile & branding" };

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-6 font-display text-3xl font-bold sm:text-4xl">Profile &amp; branding</h1>
      <ProfileManager business={business} />
    </div>
  );
}
