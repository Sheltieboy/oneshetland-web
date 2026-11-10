"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inviteMember, removeMember, revokeInvite, setMemberRole } from "@/app/organise/actions";
import { can } from "@/lib/editions/rules";
import { ROLE_LABEL, type OrgRole } from "@/lib/editions/types";
import { inviteInput } from "@/lib/editions/validate";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { Field, Notice, Pill, btnPrimary, btnQuiet, inputCls } from "./kit";
import { useAction } from "./use-action";

export type TeamMember = { user_id: string; role: OrgRole; full_name: string | null; joined_at: string };
export type PendingInvite = { id: string; email: string; role: "admin" | "editor"; expires_at: string };

const fmtDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(iso));

export function TeamManager({ slug, role, selfId, members, invites }: { slug: string; role: OrgRole; selfId: string; members: TeamMember[]; invites: PendingInvite[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const isOwner = can(role, "owner");
  const roleAction = useAction();
  const removeAction = useAction();
  const inviteAction = useAction();
  const revokeAction = useAction();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor">("editor");

  function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    const v = inviteInput({ email, role: inviteRole });
    if (!v.ok) return inviteAction.setMsg({ ok: false, text: v.error });
    inviteAction.run(() => inviteMember(slug, { email, role: inviteRole }), { success: `Invitation sent to ${v.value.email}. They will see it under Organiser tools when they sign in.`, onOk: () => { setEmail(""); router.refresh(); } });
  }

  async function remove(m: TeamMember) {
    const self = m.user_id === selfId;
    const ok = await confirm({
      title: self ? "Leave this organiser?" : "Remove this person?",
      body: self ? "You will lose access to this organiser and its Editions." : `${m.full_name ?? "This person"} will lose access to this organiser and its Editions.`,
      confirmLabel: self ? "Leave" : "Remove", danger: true,
    });
    if (!ok) return;
    removeAction.run(() => removeMember(slug, m.user_id), { onOk: (r) => (r.left ? router.push("/organise") : router.refresh()) });
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="team-h">
        <h2 id="team-h" className="font-display text-xl font-bold text-ink">People</h2>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{m.full_name ?? "OneShetland member"}{m.user_id === selfId && <span className="ml-2 text-xs font-normal text-ink-muted">(you)</span>}</p>
                <p className="text-xs text-ink-muted">Joined {fmtDate(m.joined_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                {isOwner ? (
                  <>
                    <label className="sr-only" htmlFor={`role-${m.user_id}`}>Role for {m.full_name ?? "this person"}</label>
                    <select id={`role-${m.user_id}`} className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm" value={m.role} disabled={roleAction.pending}
                      onChange={(e) => roleAction.run(() => setMemberRole(slug, m.user_id, e.target.value), { success: "Role updated.", onOk: () => router.refresh() })}>
                      <option value="owner">{ROLE_LABEL.owner}</option><option value="admin">{ROLE_LABEL.admin}</option><option value="editor">{ROLE_LABEL.editor}</option>
                    </select>
                  </>
                ) : <Pill label={ROLE_LABEL[m.role]} tone={m.role === "owner" ? "purple" : "blue"} />}
                {(isOwner || m.user_id === selfId) && <button type="button" onClick={() => remove(m)} disabled={removeAction.pending} className="text-sm font-semibold text-rose-700 hover:underline disabled:opacity-50">{m.user_id === selfId ? "Leave" : "Remove"}</button>}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 space-y-1"><Notice msg={roleAction.msg} /><Notice msg={removeAction.msg} /></div>
      </section>

      {isOwner && (
        <>
          <section aria-labelledby="inv-h">
            <h2 id="inv-h" className="font-display text-xl font-bold text-ink">Invite someone</h2>
            <p className="mt-1 text-sm text-ink-soft">Use the email address they sign in to OneShetland with. Invitations last 14 days. Administrators can manage Editions and publish; Editors can change content only.</p>
            <form onSubmit={sendInvite} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end" noValidate>
              <Field label="Email address" htmlFor="inv-email"><input id="inv-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></Field>
              <Field label="Role" htmlFor="inv-role">
                <select id="inv-role" className={inputCls} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "admin" | "editor")}>
                  <option value="editor">Editor</option><option value="admin">Administrator</option>
                </select>
              </Field>
              <button type="submit" disabled={inviteAction.pending} className={btnPrimary}>{inviteAction.pending ? "Sending…" : "Send invitation"}</button>
            </form>
            <div className="mt-2"><Notice msg={inviteAction.msg} /></div>
          </section>

          {invites.length > 0 && (
            <section aria-labelledby="pend-h">
              <h2 id="pend-h" className="font-display text-xl font-bold text-ink">Waiting to join</h2>
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
                {invites.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0"><p className="truncate font-semibold text-ink">{i.email}</p><p className="text-xs text-ink-muted">{ROLE_LABEL[i.role]} · expires {fmtDate(i.expires_at)}</p></div>
                    <button type="button" className={btnQuiet} disabled={revokeAction.pending} onClick={() => revokeAction.run(() => revokeInvite(slug, i.id), { onOk: () => router.refresh() })}>Withdraw</button>
                  </li>
                ))}
              </ul>
              <div className="mt-2"><Notice msg={revokeAction.msg} /></div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** For editors, who cannot see the team: just a way to leave. */
export function LeaveOrganiser({ slug, selfId }: { slug: string; selfId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { pending, msg, run } = useAction();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} className="text-sm font-semibold text-rose-700 hover:underline disabled:opacity-50"
        onClick={async () => { if (await confirm({ title: "Leave this organiser?", body: "You will lose access to its Editions.", confirmLabel: "Leave", danger: true })) run(() => removeMember(slug, selfId), { onOk: () => router.push("/organise") }); }}>
        Leave this organiser
      </button>
      <Notice msg={msg} />
    </div>
  );
}
