import Link from "next/link";
import { NewOrganiserForm } from "@/components/editions-manage/OrganiserForm";
import { Panel } from "@/components/editions-manage/kit";
import { gate } from "../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "New organiser" };

export default async function NewOrganiserPage() {
  await gate("/organise/new");
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/organise" className="text-sm text-ink-muted hover:underline">← Organiser tools</Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Create an organiser</h1>
      <p className="mt-1 text-ink-soft">The group that runs your events. You will be its owner and can add your team afterwards.</p>
      <div className="mt-6 space-y-6">
        <Panel tone="warm" title="About verification">
          <p className="text-sm text-ink-soft">You can build and preview Editions straight away. To publish one, OneShetland first verifies your organiser: after creating it you send us a few details about who you are, and we review them. Editions stay private to your team until then. Some well-known event names need an extra check to protect the people who run them.</p>
        </Panel>
        <Panel><NewOrganiserForm /></Panel>
      </div>
    </div>
  );
}
