"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createOrganiser, updateOrganiserProfile } from "@/app/organise/actions";
import type { Organiser } from "@/lib/editions/types";
import { slugify } from "@/lib/editions/rules";
import { organiserCreate, organiserProfile } from "@/lib/editions/validate";
import { Field, Notice, btnPrimary, inputCls } from "./kit";
import { useAction } from "./use-action";

/** Create a new organiser (name, address, tagline, description). Branding and contact details come after, on the profile page. */
export function NewOrganiserForm() {
  const router = useRouter();
  const { pending, msg, run, setMsg } = useAction();
  const [f, setF] = useState({ name: "", slug: "", tagline: "", description: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setF((p) => ({ ...p, [k]: v, ...(k === "name" && !slugTouched ? { slug: slugify(v) } : {}) }));
  };
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = organiserCreate(f);
    if (!v.ok) return setMsg({ ok: false, text: v.error });
    run(() => createOrganiser(f), { onOk: (r) => router.push(`/organise/${r.slug}`) });
  }
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field label="Organiser name" htmlFor="o-name" hint="The name people will see, for example the committee or company that runs the event.">
        <input id="o-name" className={inputCls} value={f.name} onChange={set("name")} maxLength={120} required autoComplete="organization" />
      </Field>
      <Field label="Web address" htmlFor="o-slug" hint={<>Your public page will be <span className="font-semibold">oneshetland.com/organisers/{f.slug || "your-name"}</span>. This cannot be changed later.</>}>
        <input id="o-slug" className={inputCls} value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug")(e); }} maxLength={60} required autoCapitalize="none" spellCheck={false} />
      </Field>
      <Field label="Tagline" htmlFor="o-tag" hint="One line, up to 160 characters. Optional.">
        <input id="o-tag" className={inputCls} value={f.tagline} onChange={set("tagline")} maxLength={160} />
      </Field>
      <Field label="About" htmlFor="o-desc" hint="Who you are and what you run. Optional; you can add it later.">
        <textarea id="o-desc" className={inputCls} rows={4} value={f.description} onChange={set("description")} maxLength={4000} />
      </Field>
      <Notice msg={msg} />
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Creating…" : "Create organiser"}</button>
    </form>
  );
}

/** The organiser profile: editable by administrators and owners. */
export function OrganiserProfileForm({ organiser, canEdit }: { organiser: Organiser; canEdit: boolean }) {
  const { pending, msg, run, setMsg } = useAction();
  const router = useRouter();
  const [f, setF] = useState({
    name: organiser.name, tagline: organiser.tagline ?? "", description: organiser.description ?? "", logo_url: organiser.logo_url ?? "", cover_url: organiser.cover_url ?? "", cover_focus: organiser.cover_focus ?? "",
    brand_color: organiser.brand_color ?? "", website: organiser.website ?? "", contact_email: organiser.contact_email ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = organiserProfile(f);
    if (!v.ok) return setMsg({ ok: false, text: v.error });
    run(() => updateOrganiserProfile(organiser.slug, f), { success: "Profile saved.", onOk: () => router.refresh() });
  }
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <fieldset disabled={!canEdit} className="space-y-5">
        <p className="rounded-xl border border-line bg-sand/40 px-4 py-3 text-sm text-ink-soft">
          Your logo, colour and cover photograph live on the <Link href={`/organise/${organiser.slug}/brand`} className="font-semibold text-navy underline underline-offset-2">Brand</Link> page, with a live preview.
        </p>
        <Field label="Organiser name" htmlFor="p-name"><input id="p-name" className={inputCls} value={f.name} onChange={set("name")} maxLength={120} required /></Field>
        <Field label="Tagline" htmlFor="p-tag" hint="Up to 160 characters."><input id="p-tag" className={inputCls} value={f.tagline} onChange={set("tagline")} maxLength={160} /></Field>
        <Field label="About" htmlFor="p-desc"><textarea id="p-desc" className={inputCls} rows={5} value={f.description} onChange={set("description")} maxLength={4000} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Website" htmlFor="p-web" hint="A full link starting with https://"><input id="p-web" className={inputCls} value={f.website} onChange={set("website")} inputMode="url" placeholder="https://" /></Field>
          <Field label="Contact email" htmlFor="p-mail" hint="Shown publicly if the page displays it."><input id="p-mail" type="email" className={inputCls} value={f.contact_email} onChange={set("contact_email")} /></Field>
        </div>
      </fieldset>
      {!canEdit && <p className="text-sm text-ink-muted">Only administrators and owners can edit the profile.</p>}
      <Notice msg={msg} />
      {canEdit && <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save profile"}</button>}
    </form>
  );
}
