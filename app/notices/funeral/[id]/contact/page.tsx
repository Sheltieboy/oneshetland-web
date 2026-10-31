import Link from "next/link";
import { notFound } from "next/navigation";
import { getFuneralNotice } from "@/lib/notices-data";
import { FuneralEnquiryForm } from "@/components/notices/FuneralEnquiryForm";
import { Notice } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contact us about this announcement" };

/**
 * Anyone can ask about a published announcement without an account: to correct it, to ask for it to be removed, or to ask a question. The request goes to our
 * team, who check who is asking (with the funeral director or an independent contact) before anything changes. Nothing is published or changed by this form.
 */
export default async function FuneralContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getFuneralNotice(id);
  if (r.ok && !r.data) notFound();
  return (
    <div className="px-5 py-8 sm:py-12" style={{ background: "#ece5d6" }}>
      <div className="mx-auto max-w-2xl">
        <Link href={`/notices/funeral/${id}`} className="inline-flex min-h-[44px] items-center text-sm font-semibold underline" style={{ color: "#2b3a47" }}>{"←"} The announcement</Link>
        <h1 className="mt-3 font-display text-3xl font-bold" style={{ color: "#2b3a47" }}>Contact us about this announcement</h1>
        <p className="mt-3" style={{ color: "#2b3a47" }}>
          You do not need an account. Tell us what is wrong, or ask for the announcement to be removed, and leave a way for us to reach you. Nothing changes until we have
          checked with the family&rsquo;s funeral director or another independent contact that the request is genuine, so we may call you or them.
        </p>
        <div className="mt-6">
          {!r.ok && <Notice tone="error">This announcement could not be loaded just now ({r.error}). Please try again, or use the details below.</Notice>}
          {r.ok && r.data && <FuneralEnquiryForm id={id} />}
        </div>
        <section className="mt-8 rounded-sm border bg-white/60 px-5 py-4 text-sm" style={{ borderColor: "#cdbfa6", color: "#2b3a47" }}>
          <h2 className="font-semibold">Prefer to speak to someone?</h2>
          <p className="mt-1">
            Our <Link href="/support" className="font-semibold underline">support page</Link> has our email address and telephone number. Please quote this announcement&rsquo;s
            reference: <span className="break-all font-mono text-xs">{id}</span>.
          </p>
          <p className="mt-2">We keep your contact details only for as long as it takes to deal with your request, we never show them publicly, and we do not use them for anything else.</p>
        </section>
      </div>
    </div>
  );
}
