"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrganiserProfile } from "@/app/organise/actions";
import type { Organiser } from "@/lib/editions/types";
import { organiserProfile } from "@/lib/editions/validate";
import { Field, Notice, btnPrimary, inputCls } from "./kit";
import { useAction } from "./use-action";

/**
 * The few things an Edition's profile keeps of its own: a one-line tagline, a contact email and a website to show instead of the parent's. Everything else (name, logo, cover,
 * description) comes live from the Business or Hub. Saves through the existing profile action, which never writes the name.
 */
export function IdentityPanel({ organiser, canEdit }: { organiser: Organiser; canEdit: boolean }) {
  const router = useRouter();
  const { pending, msg, run, setMsg } = useAction();
  const [f, setF] = useState({ tagline: organiser.tagline ?? "", website: organiser.website ?? "", contact_email: organiser.contact_email ?? "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const full = { name: organiser.name, description: organiser.description ?? "", logo_url: organiser.logo_url ?? "", cover_url: organiser.cover_url ?? "", cover_focus: organiser.cover_focus ?? "", brand_color: organiser.brand_color ?? "", ...f };
    const v = organiserProfile(full);
    if (!v.ok) return setMsg({ ok: false, text: v.error });
    run(() => updateOrganiserProfile(organiser.slug, full), { success: "Saved.", onOk: () => router.refresh() });
  }
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <fieldset disabled={!canEdit} className="space-y-5">
        <Field label="Tagline" htmlFor="id-tag" hint="One line shown under the name on your Editions page. Up to 160 characters. Optional."><input id="id-tag" className={inputCls} value={f.tagline} onChange={set("tagline")} maxLength={160} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Website for your Editions" htmlFor="id-web" hint="Leave empty to use the website from your profile."><input id="id-web" className={inputCls} value={f.website} onChange={set("website")} inputMode="url" placeholder="https://" /></Field>
          <Field label="Contact email" htmlFor="id-mail" hint="Shown publicly if a page displays it."><input id="id-mail" type="email" className={inputCls} value={f.contact_email} onChange={set("contact_email")} /></Field>
        </div>
      </fieldset>
      {!canEdit && <p className="text-sm text-ink-muted">Only administrators can change these.</p>}
      <Notice msg={msg} />
      {canEdit && <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save"}</button>}
    </form>
  );
}
