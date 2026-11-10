import type { Edition, ReviewState } from "@/lib/editions/types";

export type PreviewReasonKey =
  | "suspended" | "archived" | "draft" | "in_review" | "changes_requested" | "rejected" | "approved_unpublished" | "no_package" | "parent_inactive" | "disabled" | "test";
export type PreviewReason = { key: PreviewReasonKey; text: string };

/**
 * Why is this person seeing something the public cannot? The database already refuses non-members, so an Edition that reaches the page while not public belongs to a member or
 * staff. Wording is for owners: plain and reassuring. `entitled` and `parentLive` are read by the layout for any Edition that has been approved.
 */
export function previewReason(args: {
  edition: Pick<Edition, "status" | "is_test" | "suspended_reason"> & { review_state?: ReviewState | null };
  enabled: boolean; entitled: boolean; /** false = the Business or Hub that runs it is not active. Defaults to true. */ parentLive?: boolean;
}): PreviewReason | null {
  const { edition: e, enabled, entitled } = args;
  const parentLive = args.parentLive !== false;
  if (e.status === "suspended") return { key: "suspended", text: `OneShetland has suspended this Edition${e.suspended_reason ? `: ${e.suspended_reason}` : "."}` };
  if (e.status === "archived") return { key: "archived", text: "This Edition is archived, so it is no longer public." };
  switch (e.review_state ?? "not_submitted") {
    case "submitted": return { key: "in_review", text: "Only your team can see this. OneShetland is reviewing it, and you will get an email when there is a decision." };
    case "changes_requested": return { key: "changes_requested", text: "Only your team can see this. OneShetland has asked for a few changes before it can go live. Open the overview to read the message." };
    case "rejected": return { key: "rejected", text: "Only your team can see this. OneShetland could not approve it as it is. Open the overview to see why." };
    case "approved": break;
    default: return { key: "draft", text: "Only your team can see this. It is a draft and has not been sent to OneShetland yet." };
  }
  if (e.status === "draft") {
    return entitled
      ? { key: "approved_unpublished", text: "OneShetland has approved it. Only your team can see this until you press Publish." }
      : { key: "no_package", text: "OneShetland has approved it. Choose a package, then you can publish and everyone will be able to see it." };
  }
  if (!entitled) return { key: "no_package", text: "Its package has ended, so only your team can see this. Choose a package to put it back on OneShetland." };
  if (!parentLive) return { key: "parent_inactive", text: "Only your team can see this because your Business or Hub is not active at the moment." };
  if (!enabled) return { key: "disabled", text: "Only your team can see this because Editions is not open to the public yet." };
  if (e.is_test) return { key: "test", text: "This is a test Edition. Only your team can see it." };
  return null;
}

export function PreviewBanner({ reason, subject = "Edition" }: { reason: { text: string } | null; subject?: string }) {
  if (!reason) return null;
  return (
    <div role="note" className="border-b border-amber-300 bg-amber-100 text-amber-950">
      <div className="ed-wrap py-3 text-sm leading-relaxed">
        <p className="font-semibold">Preview: only your team can see this {subject}</p>
        <p>{reason.text}</p>
      </div>
    </div>
  );
}
