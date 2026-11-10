"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deletePage, movePage, savePage } from "@/app/organise/actions";
import type { EditionPage } from "@/lib/editions/types";
import { slugify } from "@/lib/editions/rules";
import { pageFields } from "@/lib/editions/validate";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { EmptyState, Field, Notice, Pill, btnDanger, btnPrimary, btnSecondary, inputCls } from "./kit";
import { useAction } from "./use-action";
import { MarkdownPreview } from "./MarkdownPreview";

type Draft = { id: string | null; title: string; nav_label: string; slug: string; body: string; in_nav: boolean; is_home: boolean };
const blank = (isFirst: boolean): Draft => ({ id: null, title: "", nav_label: "", slug: "", body: "", in_nav: true, is_home: isFirst });
const fromPage = (p: EditionPage): Draft => ({ id: p.id, title: p.title, nav_label: p.nav_label, slug: p.slug, body: p.body, in_nav: p.in_nav, is_home: p.is_home });

export function PageEditor({ organiserSlug, editionSlug, pages }: { organiserSlug: string; editionSlug: string; pages: EditionPage[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const save = useAction();
  const del = useAction();
  const move = useAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [tab, setTab] = useState<"write" | "preview">("write");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => {
    if (!d) return d;
    const n = { ...d, [k]: v };
    if (k === "title" && !d.id && !slugTouched) n.slug = slugify(String(v));
    return n;
  });
  const open = (d: Draft) => { setDraft(d); setSlugTouched(!!d.id); setTab("write"); save.setMsg(null); };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const position = draft.id ? pages.find((p) => p.id === draft.id)?.position ?? 0 : pages.length;
    const input = { ...draft, position };
    const v = pageFields(input);
    if (!v.ok) return save.setMsg({ ok: false, text: v.error });
    save.run(() => savePage(organiserSlug, editionSlug, draft.id, input), { success: "Page saved.", onOk: (r) => { setDraft((d) => (d ? { ...d, id: r.id } : d)); router.refresh(); } });
  }
  async function remove(p: EditionPage) {
    if (!(await confirm({ title: `Delete "${p.title}"?`, body: "This page is removed from the Edition for good.", confirmLabel: "Delete page", danger: true }))) return;
    del.run(() => deletePage(organiserSlug, editionSlug, p.id), { onOk: () => { if (draft?.id === p.id) setDraft(null); router.refresh(); } });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">Pages</h2>
          <button type="button" className={btnSecondary + " !px-4 !py-1.5"} onClick={() => open(blank(pages.length === 0))}>New page</button>
        </div>
        {pages.length === 0 ? (
          <div className="mt-3"><EmptyState>No pages yet. A welcome page gives visitors somewhere to start.</EmptyState></div>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
            {pages.map((p, i) => (
              <li key={p.id} className={"flex items-center gap-2 px-3 py-2.5 " + (draft?.id === p.id ? "bg-sand/60" : "")}>
                <button type="button" onClick={() => open(fromPage(p))} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-ink">{p.title}</span>
                  <span className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-ink-muted">/{p.slug}{p.is_home && <Pill label="Home" tone="blue" />}{!p.in_nav && !p.is_home && <Pill label="Not in menu" />}</span>
                </button>
                <div className="flex flex-col">
                  <button type="button" aria-label={`Move ${p.title} up`} disabled={i === 0 || move.pending} className="px-1 text-ink-muted hover:text-ink disabled:opacity-30" onClick={() => move.run(() => movePage(organiserSlug, editionSlug, p.id, "up"), { onOk: () => router.refresh() })}>▲</button>
                  <button type="button" aria-label={`Move ${p.title} down`} disabled={i === pages.length - 1 || move.pending} className="px-1 text-ink-muted hover:text-ink disabled:opacity-30" onClick={() => move.run(() => movePage(organiserSlug, editionSlug, p.id, "down"), { onOk: () => router.refresh() })}>▼</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 space-y-1"><Notice msg={del.msg} /><Notice msg={move.msg} /></div>
      </div>

      <div>
        {!draft ? (
          <EmptyState>Choose a page to edit, or add a new one.</EmptyState>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-card border border-line bg-paper p-5 shadow-soft" noValidate>
            <h2 className="font-display text-xl font-bold text-ink">{draft.id ? "Edit page" : "New page"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="pg-title"><input id="pg-title" className={inputCls} value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={140} required /></Field>
              <Field label="Menu label" htmlFor="pg-nav" hint="Short, up to 30 characters. Defaults to the title."><input id="pg-nav" className={inputCls} value={draft.nav_label} onChange={(e) => set("nav_label", e.target.value)} maxLength={30} /></Field>
            </div>
            <Field label="Page address" htmlFor="pg-slug" hint="Filled in from the title. Letters, numbers and hyphens. The programme, updates, partners and sponsors already have their own built-in pages.">
              <input id="pg-slug" className={inputCls} value={draft.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} maxLength={60} autoCapitalize="none" spellCheck={false} />
            </Field>
            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.is_home} onChange={(e) => set("is_home", e.target.checked)} /> This is the home page</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.in_nav || draft.is_home} disabled={draft.is_home} onChange={(e) => set("in_nav", e.target.checked)} /> Show in the menu</label>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="pg-body" className="text-sm font-semibold text-ink">Text</label>
                <div role="tablist" aria-label="Editor view" className="flex gap-1 text-xs font-semibold lg:hidden">
                  {(["write", "preview"] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={"rounded-pill px-3 py-1 " + (tab === t ? "bg-navy text-paper" : "bg-sand text-ink-soft")}>{t === "write" ? "Write" : "Preview"}</button>)}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className={tab === "preview" ? "hidden lg:block" : ""}>
                  <textarea id="pg-body" className={inputCls + " font-mono text-sm"} rows={14} value={draft.body} onChange={(e) => set("body", e.target.value)} maxLength={20000} aria-describedby="pg-help" />
                  <p id="pg-help" className="mt-1 text-xs text-ink-muted">{draft.body.length.toLocaleString()}/20,000. Use ## for headings, - for lists, **bold**, *italic* and [link text](https://…).</p>
                </div>
                <div className={"rounded-xl border border-line bg-cream/40 p-4 " + (tab === "write" ? "hidden lg:block" : "")} aria-label="Preview">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Preview</p>
                  <MarkdownPreview source={draft.body} />
                </div>
              </div>
            </div>

            <Notice msg={save.msg} />
            <div className="flex flex-wrap gap-2.5">
              <button type="submit" disabled={save.pending} className={btnPrimary}>{save.pending ? "Saving…" : "Save page"}</button>
              {draft.id && <button type="button" className={btnDanger} onClick={() => remove(pages.find((p) => p.id === draft.id)!)}>Delete</button>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
