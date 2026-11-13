import Link from "next/link";
import { sendEnquiry } from "@/app/house-swaps/actions";
import { ENQUIRY_STARTER, NEVER_PAY, LIMITS, signInHref } from "@/lib/house-swaps";
import { ActionForm } from "./ActionForm";
import { btnPrimary, fieldCls } from "./Shell";

/** "Express interest privately". Signed out, it points at sign-in and returns here. */
export function EnquiryForm({ listingId, signedIn, hasAdvert }: { listingId: string; signedIn: boolean; hasAdvert: boolean }) {
  if (!signedIn) {
    return (
      <div>
        <p className="text-base text-ink-soft">Sign in to send a private message. You will come straight back to this advert.</p>
        <Link href={signInHref(`/house-swaps/${listingId}`)} className={`${btnPrimary} mt-3`}>Sign in to express interest</Link>
      </div>
    );
  }
  return (
    <ActionForm action={sendEnquiry} resetOnOk={false} refreshOnOk={false} className="space-y-3">
      <input type="hidden" name="listing" value={listingId} />
      <div>
        <label htmlFor="enq-msg" className="block text-sm font-semibold text-ink">Your message</label>
        <p id="enq-help" className="mt-0.5 text-sm text-ink-muted">Say a little about your home and why a swap could suit you both. Please don&apos;t put phone numbers or addresses here yet.</p>
        <textarea id="enq-msg" name="message" required rows={4} maxLength={LIMITS.message} defaultValue={ENQUIRY_STARTER} aria-describedby="enq-help" className={`${fieldCls} mt-1`} />
      </div>
      <p className="text-sm font-semibold text-ink">{NEVER_PAY}</p>
      {!hasAdvert && <p className="text-sm text-ink-muted">Tip: members with their own advert on the noticeboard are easier to match. <Link className="font-semibold underline" href="/house-swaps/my">Add yours</Link>.</p>}
      <button type="submit" className={btnPrimary}>Send private message</button>
    </ActionForm>
  );
}
