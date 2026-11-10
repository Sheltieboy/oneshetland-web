import Link from "next/link";
import { PackagesPanel } from "@/components/editions-commerce/PackagesPanel";
import { getActivePackages, getCommerceEnabled, getOrgOrders } from "@/lib/editions/commerce.server";
import { can } from "@/lib/editions/rules";
import { activeUntil } from "@/lib/editions/journey";
import { EDITION_COLUMNS, type Edition, type EditionEntitlement } from "@/lib/editions/types";
import { organiserPage } from "../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Packages" };

export default async function PackagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organiser, role, sb } = await organiserPage(slug, `/organise/${slug}/packages`, "admin");
  const [packages, orders, on, eds, ents] = await Promise.all([
    getActivePackages(organiser.id), getOrgOrders(organiser.id), getCommerceEnabled(),
    sb.from("editions").select(EDITION_COLUMNS).eq("organiser_id", organiser.id).neq("status", "archived").order("starts_on", { ascending: false }),
    sb.from("edition_entitlements").select("*").eq("organiser_id", organiser.id),
  ]);
  const entitlements = (ents.data ?? []) as EditionEntitlement[];
  const editions = ((eds.data ?? []) as Edition[]).map((e) => ({ slug: e.slug, title: e.title, status: e.status, review_state: e.review_state, activeUntil: activeUntil(entitlements.filter((x) => x.edition_id === e.id)) }));
  return (
    <div className="mx-auto max-w-4xl">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted"><Link href="/organise" className="hover:underline">Organiser tools</Link> / <Link href={`/organise/${slug}`} className="hover:underline">{organiser.name}</Link></nav>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Packages</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">A package covers an Edition for a period of time so you can publish it, and can include taking payments, memberships and exports. You choose one inside each Edition once OneShetland has approved it. (Payments from your own members go straight to you.)</p>
      <div className="mt-6"><PackagesPanel slug={slug} packages={packages} editions={editions} orders={orders} isAdmin={can(role, "admin")} commerceOn={on} /></div>
    </div>
  );
}
