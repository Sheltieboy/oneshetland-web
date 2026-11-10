import Link from "next/link";
import { can } from "@/lib/editions/rules";
import { BrandStudio } from "@/components/editions-manage/BrandStudio";
import { organiserPage } from "../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand" };

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organiser, role } = await organiserPage(slug, `/organise/${slug}/brand`);
  return (
    <div>
      <Link href={`/organise/${slug}`} className="text-sm text-ink-muted hover:underline">← {organiser.name}</Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Your brand</h1>
      <p className="mt-1 max-w-[62ch] text-ink-soft">Give us a logo, one colour, one photograph and your name. We handle the rest: tones, typeface, layout and readability, so every page looks professionally designed and works for everyone. Your brand is reused across all your Editions.</p>
      <div className="mt-8"><BrandStudio organiser={organiser} canEdit={can(role, "admin")} /></div>
    </div>
  );
}
