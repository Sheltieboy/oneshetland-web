import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBusiness } from "@/lib/local-data";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BusinessClaimForm } from "@/components/directory/BusinessClaimForm";

export const dynamic = "force-dynamic";

const LOCAL = "#7c3aed";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBusiness(id);
  return { title: b ? `Claim ${b.name} · Directory` : "Claim listing · Directory" };
}

export default async function ClaimBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=/directory/${id}/claim`);

  const b = await getBusiness(id);
  if (!b) notFound();

  // Any prior claim by this user for this business (to show pending/approved state).
  const sb = await createClient();
  const { data: existing } = await sb
    .from("business_claims")
    .select("status")
    .eq("user_id", account.id)
    .eq("business_id", b.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingStatus = (existing?.status ?? null) as "pending" | "approved" | "rejected" | null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link
        href={`/directory/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
        style={{ color: LOCAL }}
      >
        ← {b.name}
      </Link>

      <div className="mt-6">
        <p className="eyebrow" style={{ color: LOCAL }}>OneShetland</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Claim this listing</h1>
        <p className="mt-3 text-lg text-ink-soft">
          Verify that you run this business to manage its details, offers, loyalty and bookings.
        </p>
      </div>

      <div className="mt-8">
        <BusinessClaimForm
          businessId={b.id}
          businessName={b.name}
          alreadyClaimed={b.is_claimed}
          existingStatus={existingStatus}
          defaultName={account.profile?.full_name ?? ""}
          defaultPhone={account.profile?.phone ?? ""}
        />
      </div>
    </div>
  );
}
