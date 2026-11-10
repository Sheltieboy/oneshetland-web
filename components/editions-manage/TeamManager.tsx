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

/** `via_hub` is the database's name for "comes with the Business or Hub": the owner, and for a Hub its committee. */
export type TeamMember = { user_id: string; role: OrgRole; full_name: string | null; joined_at: string; via_hub?: boolean };
export type PendingInvite = { id: string; email: string; role: "admin" | "editor"; expires_at: string };

const fmtDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(iso));
export const HELPER_ROLE_CHOICES: { value: "admin" | "editor"; label: string }[] = [
  { value: "admin", label: "Administrator: can submit, publish and choose packages" },
  { value: "editor", label: "Editor: can edit content only" },
];

export function TeamManager({ slug, role, selfId, members, invites, parentKind = "hub" }: { slug: string; role: OrgRole; selfId: string; members: TeamMember[]; invites: PendingInvite[]; parentKind?: "hub" | "business" }) {
  const router = useRouter();
  const confirm = useConfirm();
  const isOwner = can(role, "owner");
  const roleAction = useAction();
  const removeAction = useAction();
  const inviteAction = useAction();
  const revokeAction = useAction();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor">("editor");
  const parent = parentKind === "business" ? "Business" : "Hub";
  const withParent = members.filter((m) => m.via_hub);
  const helpers = members.filter((m) => !m.via_hub);

  function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    const v = inviteInput({ email, role: inviteRole });
    if (!v.ok) return inviteAction.setMsg({ ok: false, text: v.error });
    inviteAction.run(() => inviteMember(slug, { email, role: inviteRole }), { success: `We have emailed ${v.value.email}. They can also accept it on this page when they sign in with that address.`, onOk: () => { setEmail(""); router.refresh(); } });
  }

  async function remove(m: TeamMember) {
    const self = m.user_id === selfId;
    const ok = await confirm({
      title: self ? "Stop helping with these Editions?" : "Remove this helper?",
      body: self ? "You will lose access to these Editions." : `${m.full_name ?? "This person"} will lose access to these Editions.`,
      confirmLabel: self ? "Leave" : "Remove", danger: true,
    });
    if (!ok) return;
    removeAction.run(() => removeMember(slug, m.user_id), { onOk: (r) => (r.left ? router.push("/organise") : router.refresh()) });
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="with-h">
        <h2 id="with-h" className="font-display text-xl font-bold text-ink">Comes with your {parent}</h2>
        <p className="mt-1 text-sm text-ink-soft">{parentKind === "hub" ? "Your Hub's owner is the owner, and everyone on its committee is an administrator. This follows your committee automatically." : "The owner of your Business is the owner. This follows your Business automatically."}</p>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
          {withParent.length === 0 && <li className="px-4 py-3 text-sm text-ink-muted">No one yet.</li>}
          {withParent.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0"><p className="truncate font-semibold text-ink">{m.full_name ?? "OneShetland member"}{m.user_id === selfId && <span className="ml-2 text-xs font-normal text-ink-muted">(you)</span>}</p><p className="text-xs text-ink-muted">To change this, change it in your {parent}.</p></div>
              <Pill label={`${ROLE_LABEL[m.role]} · ${parent}`} tone="purple" />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="helpers-h">
        <h2 id="helpers-h" className="font-display text-xl font-bold text-ink">Invited helpers</h2>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
          {helpers.length === 0 && <li className="px-4 py-3 text-sm text-ink-muted">No helpers yet. {isOwner ? "Invite someone below." : ""}</li>}
          {helpers.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0"><p className="truncate font-semibold text-ink">{m.full_name ?? "OneShetland member"}{m.user_id === selfId && <span className="ml-2 text-xs font-normal text-ink-muted">(you)</span>}</p><p className="text-xs text-ink-muted">Joined {fmtDate(m.joined_at)}</p></div>
              <div className="flex items-center gap-3">
                {isOwner && m.role !== "owner" ? (
                  <>
                    <label className="sr-only" htmlFor={`role-${m.user_id}`}>What {m.full_name ?? "this person"} can do</label>
                    <select id={`role-${m.user_id}`} className="min-h-[44px] rounded-lg border border-line bg-paper px-2 py-1.5 text-sm" value={m.role} disabled={roleAction.pending}
                      onChange={(e) => roleAction.run(() => setMemberRole(slug, m.user_id, e.target.value), { success: "Updated.", onOk: () => router.refresh() })}>
                      <option value="admin">{ROLE_LABEL.admin}</option><option value="editor">{ROLE_LABEL.editor}</option>
                    </select>
                  </>
                ) : <Pill label={ROLE_LABEL[m.role]} tone="blue" />}
                {(isOwner || m.user_id === selfId) && <button type="button" onClick={() => remove(m)} disabled={removeAction.pending} className="min-h-[44px] text-sm font-semibold text-rose-700 hover:underline disabled:opacity-50">{m.user_id === selfId ? "Leave" : "Remove"}</button>}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 space-y-1"><Notice msg={roleAction.msg} /><Notice msg={removeAction.msg} /></div>
      </section>

      {isOwner && (
        <>
          <section aria-labelledby="inv-h">
            <h2 id="inv-h" className="font-display text-xl font-bold text-ink">Invite a helper</h2>
            <p className="mt-1 text-sm text-ink-soft">Use the email address they sign in to OneShetland with. We email them the invitation, and it lasts 14 days.</p>
            <form onSubmit={sendInvite} className="mt-3 space-y-4" noValidate>
              <Field label="Email address" htmlFor="inv-email"><input id="inv-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></Field>
              <fieldset>
                <legend className="mb-1 text-sm font-semibold text-ink">What can they do?</legend>
                <div className="space-y-2">
                  {HELPER_ROLE_CHOICES.map((c) => (
                    <label key={c.value} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink">
                      <input type="radio" name="inv-role" value={c.value} checked={inviteRole === c.value} onChange={() => setInviteRole(c.value)} className="h-4 w-4" />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
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
                    <div className="min-w-0"><p className="truncate font-semibold text-ink">{i.email}</p><p className="text-xs text-ink-muted">We have emailed {i.email} · {ROLE_LABEL[i.role]} · expires {fmtDate(i.expires_at)}</p></div>
                    <button type="button" className={`${btnQuiet} min-h-[44px]`} disabled={revokeAction.pending} onClick={() => revokeAction.run(() => revokeInvite(slug, i.id), { onOk: () => router.refresh() })}>Withdraw</button>
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
      <button type="button" disabled={pending} className="min-h-[44px] text-sm font-semibold text-rose-700 hover:underline disabled:opacity-50"
        onClick={async () => { if (await confirm({ title: "Stop helping with these Editions?", body: "You will lose access to them.", confirmLabel: "Leave", danger: true })) run(() => removeMember(slug, selfId), { onOk: () => router.push("/organise") }); }}>
        Stop helping with these Editions
      </button>
      <Notice msg={msg} />
    </div>
  );
}
