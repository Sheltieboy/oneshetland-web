import { inviteReviewer, removeReviewer } from "@/app/house-swaps/actions";
import { formatDate, type InviteRow } from "@/lib/house-swaps";
import { Notice } from "@/components/notices/NoticesShell";
import { ActionForm } from "./ActionForm";
import { Panel, btnPrimary, btnSecondary, fieldCls } from "./Shell";

/** Staff only (rendered by the moderation page after its role check; the database refuses anyone else). Emails are shown here and nowhere else. */
export function InvitesPanel({ invites, error }: { invites: InviteRow[]; error?: string }) {
  return (
    <Panel aria-labelledby="pr" className="mb-8">
      <h2 id="pr" className="font-display text-2xl font-bold text-ink">Preview reviewers</h2>
      <p className="mt-1 text-sm text-ink-muted">While House Swaps is in private preview, only staff and the people listed here can use it. They can sign in or create a normal OneShetland account with this address.</p>
      {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
      {!error && invites.length === 0 && <p className="mt-3 text-sm text-ink-muted">No reviewers invited yet.</p>}
      {invites.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {invites.map((i) => (
            <li key={i.email} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold text-ink">{i.email}</p>
                <p className="text-xs text-ink-muted">{i.has_account ? "Has an account" : "No account yet"} · added {formatDate(i.added_at)}{i.note ? ` · ${i.note}` : ""}</p>
              </div>
              <ActionForm action={removeReviewer} resetOnOk={false}>
                <input type="hidden" name="email" value={i.email} />
                <button type="submit" className={btnSecondary}>Remove<span className="sr-only"> {i.email}</span></button>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
      <ActionForm action={inviteReviewer} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="inv-email" className="block text-sm font-semibold text-ink">Email address</label>
          <input id="inv-email" name="email" type="email" required autoComplete="off" maxLength={254} className={fieldCls} />
        </div>
        <div>
          <label htmlFor="inv-note" className="block text-sm font-semibold text-ink">Note (optional)</label>
          <input id="inv-note" name="note" maxLength={200} autoComplete="off" className={fieldCls} />
        </div>
        <button type="submit" className={btnPrimary}>Invite</button>
      </ActionForm>
    </Panel>
  );
}
