import type { Edition } from "@/lib/editions/types";

export type PreviewReason = { key: "suspended" | "archived" | "draft" | "unentitled" | "disabled" | "test" | "unverified"; text: string };

/**
 * Why is this person seeing something the public cannot? The database already refuses non-members, so a bundle that reaches the page for a
 * non-public Edition belongs to a member or staff. `entitled` is only read for a published Edition (the answer is moot otherwise).
 */
export function previewReason(args: { edition: Pick<Edition, "status" | "is_test" | "suspended_reason">; enabled: boolean; entitled: boolean }): PreviewReason | null {
  const { edition: e, enabled, entitled } = args;
  if (e.status === "suspended") return { key: "suspended", text: `This Edition is suspended by OneShetland${e.suspended_reason ? `: ${e.suspended_reason}` : "."}` };
  if (e.status === "archived") return { key: "archived", text: "This Edition is archived and no longer public." };
  if (e.status === "draft") return { key: "draft", text: "This Edition is a draft and has not been published." };
  if (!entitled) return { key: "unentitled", text: "This Edition is not yet entitled to appear publicly: it needs an active package or grant." };
  if (!enabled) return { key: "disabled", text: "Editions are not switched on for the public yet." };
  if (e.is_test) return { key: "test", text: "This is a test Edition and is never shown to the public." };
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
