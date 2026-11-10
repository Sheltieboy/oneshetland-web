import Link from "next/link";
import { can } from "@/lib/editions/rules";
import { OrganiserProfileForm } from "@/components/editions-manage/OrganiserForm";
import { Panel } from "@/components/editions-manage/kit";
import { organiserPage } from "../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organiser profile" };

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organiser, role } = await organiserPage(slug, `/organise/${slug}/profile`);
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/organise/${slug}`} className="text-sm text-ink-muted hover:underline">← {organiser.name}</Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Organiser profile</h1>
      <p className="mt-1 text-ink-soft">How your organisation appears across OneShetland. Your web address (<span className="font-semibold">{organiser.slug}</span>) cannot be changed.</p>
      <div className="mt-6"><Panel><OrganiserProfileForm organiser={organiser} canEdit={can(role, "admin")} /></Panel></div>
    </div>
  );
}
