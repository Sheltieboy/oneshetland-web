import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { isSubjectType, TYPE_NOUN } from "@/lib/accessibility";
import { canEditAccessibility, getEditableAccessibility, getSubjectLabel } from "@/lib/accessibility-data";
import { AccessibilityEditor } from "@/components/accessibility/AccessibilityEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Help people plan their visit", robots: { index: false } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditAccessibilityPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if (!isSubjectType(type) || !UUID.test(id)) notFound();
  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=${encodeURIComponent(`/accessible/edit/${type}/${id}`)}`);
  if (!(await canEditAccessibility(type, id))) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="font-display text-3xl font-bold">You can’t edit this one</h1>
        <p className="mt-3 text-ink-soft">Only the owner or organiser of a {TYPE_NOUN[type]} can add its access information. If this is yours, make sure you are signed in with the account that manages it.</p>
        <Link href="/accessible" className="mt-6 inline-flex min-h-11 items-center font-semibold underline">Back to Accessible Shetland</Link>
      </div>
    );
  }
  const [label, initial] = await Promise.all([getSubjectLabel(type, id), getEditableAccessibility(type, id)]);
  if (!label) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5">
      <Link href={label.manage} className="text-sm font-semibold text-ink-soft hover:text-ink">← Back to managing {label.name}</Link>
      <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Help people plan their visit</h1>
      <p className="mt-2 text-ink-soft">Accessibility and assistance for {label.name}</p>
      <div className="mt-6"><AccessibilityEditor type={type} id={id} name={label.name} initial={initial} backHref={label.manage} viewHref={label.href} /></div>
    </div>
  );
}
