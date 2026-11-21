import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { HubSwitches } from "@/components/admin/HubsAdmin";
import { createClient } from "@/lib/supabase/server";
import { AddOnBehalf } from "@/components/admin/assisted/AddOnBehalf";
import { AssistedRecords } from "@/components/admin/assisted/AssistedRecords";
import { listAssisted } from "@/lib/assisted/client";
import { listInvites, waitingClaims } from "@/lib/assisted/invites.server";
import { ClaimsWaiting } from "@/components/admin/assisted/ClaimsWaiting";
import {
  createAssistedHubAction, forgetAssistedContactAction, editAssistedAction,
  issueAssistedInviteAction, markAssistedInviteSentAction, revokeAssistedInviteAction,
  assistedInviteAuditAction, decideAssistedClaimAction, assistedSupportStateAction,
  sendAssistedInviteEmailAction, liftAssistedContactPreferenceAction,
  recordAssistedSupportAction, endAssistedSupportAction, assistedSupportLogAction,
} from "@/app/admin/assisted/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hubs · Admin" };

type Hub = { id: string; name: string; is_verified: boolean | null; events_auto_approve: boolean | null };

/** Admin → Hubs. Reads run as the signed-in administrator; the layout already requires one. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q ?? "").trim().slice(0, 60);
  const sb = await createClient();
  let query = sb.from("hubs").select("id, name, is_verified, events_auto_approve").eq("is_active", true).order("name").limit(200);
  // Search is by name only; characters that mean something to the filter are removed rather than escaped.
  const safe = q.replace(/[%_,()*\\]/g, " ").trim();
  if (safe) query = query.ilike("name", `%${safe}%`);
  const { data, error } = await query;
  const hubs = (data ?? []) as Hub[];
  const assistedRows = await listAssisted("hub");
  const hubInvites = await listInvites("hub");
  // Keep the result whole: an unreadable queue must not render as an empty one.
  const hubClaimsResult = await waitingClaims();
  const hubClaims = hubClaimsResult.ok
    ? { ok: true as const, claims: hubClaimsResult.claims.filter((c) => c.claim_kind === "hub") }
    : hubClaimsResult;
  return (
    <>
      <AdminHeader title="Hubs" sub="Add a Hub for an organisation that asked us to, and set the two switches on each active Hub." />
      <section className="mb-6 space-y-5" aria-label="Added on behalf of others">
        <AddOnBehalf kind="hub" submit={createAssistedHubAction} />
        {(!hubClaimsResult.ok || hubClaims.ok && hubClaims.claims.length > 0) && (
          <div className="space-y-3">
            <h3 className="font-display text-lg font-bold text-ink">Waiting for your decision</h3>
            <ClaimsWaiting result={hubClaims} decide={decideAssistedClaimAction} />
          </div>
        )}
        {assistedRows.length > 0 && (
          <AssistedRecords
            rows={assistedRows} kind="hub"
            forget={forgetAssistedContactAction} edit={editAssistedAction}
            invites={hubInvites}
            issue={issueAssistedInviteAction}
            markSent={markAssistedInviteSentAction}
            revoke={revokeAssistedInviteAction}
            audit={assistedInviteAuditAction}
            sendEmail={sendAssistedInviteEmailAction}
            liftContactPreference={liftAssistedContactPreferenceAction}
            supportState={assistedSupportStateAction}
            recordSupport={recordAssistedSupportAction}
            endSupport={endAssistedSupportAction}
            supportLog={assistedSupportLogAction}
          />
        )}
      </section>
      <h2 className="mb-3 text-lg font-bold text-ink">Hub settings</h2>
      <form role="search" className="mb-5 flex flex-wrap gap-2" action="/admin/hubs" method="get">
        <label htmlFor="hub-q" className="sr-only">Search Hubs by name</label>
        <input id="hub-q" name="q" type="search" defaultValue={q} placeholder="Search Hubs by name" autoComplete="off" className="auth-input w-full max-w-sm" />
        <button type="submit" className="min-h-11 rounded-pill bg-navy px-5 text-sm font-bold text-white hover:bg-navy-dark">Search</button>
        {q && <a href="/admin/hubs" className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-navy hover:underline">Clear</a>}
      </form>
      {error ? <Empty>Hubs could not be loaded just now. Try again in a moment.</Empty> : !hubs.length ? <Empty>{q ? `No active Hub matches “${q}”.` : "There are no active Hubs."}</Empty> : (
        <ul className="space-y-4" aria-label="Hubs">
          {hubs.map((h) => <li key={h.id}><HubSwitches hubId={h.id} name={h.name} verified={!!h.is_verified} eventsSkipApproval={!!h.events_auto_approve} /></li>)}
        </ul>
      )}
    </>
  );
}
