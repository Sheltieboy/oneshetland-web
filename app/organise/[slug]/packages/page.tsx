import Link from "next/link";
import { PackagesPanel } from "@/components/editions-commerce/PackagesPanel";
import { getActivePackages, getCommerceEnabled, getOrgOrders } from "@/lib/editions/commerce.server";
import { can } from "@/lib/editions/rules";
import { organiserPage } from "../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Packages" };

export default async function PackagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organiser, role, sb } = await organiserPage(slug, `/organise/${slug}/packages`, "admin");
  const [packages, orders, on, eds] = await Promise.all([getActivePackages(), getOrgOrders(organiser.id), getCommerceEnabled(), sb.from("editions").select("slug, title").eq("organiser_id", organiser.id).neq("status", "archived").order("starts_on", { ascending: false })]);
  return (
    <div className="mx-auto max-w-4xl">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted"><Link href="/organise" className="hover:underline">Organiser tools</Link> / <Link href={`/organise/${slug}`} className="hover:underline">{organiser.name}</Link></nav>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Packages</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">A package lets you publish an Edition and can include taking payments, memberships and exports. It is paid to OneShetland. (Payments from your own members go straight to you.)</p>
      <div className="mt-6"><PackagesPanel slug={slug} packages={packages} editions={(eds.data ?? []) as { slug: string; title: string }[]} orders={orders} isOwner={can(role, "owner")} commerceOn={on} /></div>
    </div>
  );
}
