"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { invitePartner, partnerAction } from "@/app/organise/actions";
import { splitHubOwnItems, type HubOwnItem } from "@/lib/editions/partners";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { EmptyState, Notice, Panel, Pill, btnQuiet, btnSecondary } from "./kit";
import { useAction } from "./use-action";

const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }).format(new Date(iso)) : null);

/**
 * "Add from your Hub": the Hub's own events and regular activities, one click to add to this Edition. Nothing is copied and nobody is asked: the Hub's owner or
 * committee already controls these listings, so the link is approved straight away. The original is only ever referenced, never changed or deleted.
 */
export function AddFromHubPanel({ organiserSlug, editionSlug, hubName, hubSlug, items }: { organiserSlug: string; editionSlug: string; hubName: string; hubSlug: string | null; items: HubOwnItem[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { pending, msg, run } = useAction();
  const { events, activities, added } = splitHubOwnItems(items);

  function add(i: HubOwnItem) {
    run(() => invitePartner(organiserSlug, editionSlug, { kind: i.kind, subject: i.id, label: "", message: "" }), { success: `${i.title} is on your Edition.`, onOk: () => router.refresh() });
  }
  async function remove(i: HubOwnItem) {
    if (!i.link_id) return;
    if (!(await confirm({ title: `Take ${i.title} off this Edition?`, body: `It stays on ${hubName} exactly as it is. Only its place in this Edition is removed, and you can add it again any time.`, confirmLabel: "Take it off" }))) return;
    run(() => partnerAction(organiserSlug, editionSlug, i.link_id!, "remove"), { success: `${i.title} is no longer on this Edition.`, onOk: () => router.refresh() });
  }

  const row = (i: HubOwnItem) => (
    <li key={`${i.kind}-${i.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{i.title} <Pill label={i.kind === "event" ? "Event" : "Regular activity"} tone="gray" /></p>
        <p className="text-xs text-ink-soft">{[when(i.starts_at), i.venue].filter(Boolean).join(" · ") || (i.kind === "activity" ? "Meets regularly" : "")}</p>
      </div>
      {i.link_id ? (
        <div className="flex items-center gap-3"><Pill label="On this Edition" tone="green" /><button type="button" className={`${btnQuiet} inline-block px-1 py-2`} disabled={pending} onClick={() => remove(i)} aria-label={`Take ${i.title} off this Edition`}>Take off</button></div>
      ) : (
        <button type="button" className={btnSecondary} disabled={pending} onClick={() => add(i)} aria-label={`Add ${i.title} to this Edition`}>Add to Edition</button>
      )}
    </li>
  );

  return (
    <Panel id="add-from-hub" title="Add from your Hub" sub={`Choose ${hubName}’s own events and regular activities to show here. They join straight away: nothing is copied, nobody has to approve it, and changes you make to the original appear here too. Taking one off never deletes it.`}>
      <Notice msg={msg} />
      {items.length === 0 ? (
        <EmptyState>
          Nothing to add yet. Events show here when they are published, open to visitors and fall inside this Edition’s dates.{" "}
          {hubSlug && <Link href={`/hubs/${hubSlug}/manage/events`} className="font-semibold underline">Create an event for {hubName}</Link>}
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {events.length > 0 && <div><h3 className="text-sm font-bold text-ink">Events in this Edition’s dates</h3><ul className="divide-y divide-line">{events.map(row)}</ul></div>}
          {activities.length > 0 && <div><h3 className="text-sm font-bold text-ink">Regular activities</h3><ul className="divide-y divide-line">{activities.map(row)}</ul></div>}
          {added > 0 && <p className="text-xs text-ink-soft">{added} added. Events appear in the programme on their own day; regular activities appear with the Edition’s partners.</p>}
        </div>
      )}
    </Panel>
  );
}
