"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { approveLaunchSetupAction, saveLaunchSetupAction } from "@/app/business/[id]/manage/launch-setup/actions";
import { runGuarded } from "@/lib/launch-partners/invitation-replace";
import type { OwnerEdit } from "@/lib/launch-partners/owner-setup";

export interface EditorInitial {
  headline: string; tagline: string; eyebrow: string; locality: string; treatment: "photo" | "mosaic" | "brand";
  gallery: { src: string; alt: string }[]; keepGallery: string[];
  story: { title: string; body: string } | null; useful: { title: string; body: string }[];
}

const input = "mt-1 block w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:bg-sand/60";
const label = "block text-sm font-semibold text-ink-soft";

/**
 * The owner's launch-setup editor: reword what was prepared, remove what they don't want, add what's missing — all private. It saves a
 * private version (never the listing) and approval is a separate, explicit, confirmed step that publishes nothing.
 */
export function LaunchSetupEditor({ businessId, initial, locked, approvedAt }: { businessId: string; initial: EditorInitial; /** Approved: shown, not editable. */ locked: boolean; approvedAt: string | null }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState<"save" | "approve" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(f) !== saved;
  const set = (p: Partial<EditorInitial>) => setF((x) => ({ ...x, ...p }));
  const edit = (): OwnerEdit => ({ headline: f.headline, tagline: f.tagline, eyebrow: f.eyebrow, locality: f.locality, treatment: f.treatment, keepGallery: f.keepGallery, story: f.story, useful: f.useful });

  async function save() {
    setBusy("save"); setMsg(null);
    const g = await runGuarded(() => saveLaunchSetupAction(businessId, edit()));
    setBusy(null);
    if (!g.ok) { setMsg({ ok: false, text: g.error }); return; }
    if (!g.value.ok) { setMsg({ ok: false, text: g.value.error }); return; }
    setSaved(JSON.stringify(f)); setMsg({ ok: true, text: "Saved privately. Nothing is public." }); router.refresh();
  }

  async function approve() {
    const ok = await confirm({
      title: "Approve your launch setup?",
      body: "You’re saying this is the page you want. Approving does not publish anything: your page and content stay private, and nothing changes on your public listing. You’ll be told when you can go live.",
      confirmLabel: "Approve my setup",
    });
    if (!ok) return;
    setBusy("approve"); setMsg(null);
    const g = await runGuarded(() => approveLaunchSetupAction(businessId), 60_000);
    setBusy(null);
    if (!g.ok) { setMsg({ ok: false, text: g.error }); router.refresh(); return; }
    if (!g.value.ok) { setMsg({ ok: false, text: g.value.error }); router.refresh(); return; }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <fieldset disabled={locked || !!busy} className="space-y-4 rounded-card border border-line bg-paper p-5 shadow-soft">
        <legend className="sr-only">Your page</legend>
        <h2 className="font-display text-xl font-bold text-ink">Your page</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Name shown on your page <span className="font-normal text-ink-muted">(leave blank to use your business name)</span>
            <input className={input} value={f.headline} maxLength={160} onChange={(e) => set({ headline: e.target.value })} />
          </label>
          <label className={label}>Kind of business <span className="font-normal text-ink-muted">(a short label)</span>
            <input className={input} value={f.eyebrow} maxLength={120} onChange={(e) => set({ eyebrow: e.target.value })} />
          </label>
        </div>
        <label className={label}>The line under your name
          <textarea className={input} rows={2} value={f.tagline} maxLength={400} onChange={(e) => set({ tagline: e.target.value })} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Where you are
            <input className={input} value={f.locality} maxLength={160} onChange={(e) => set({ locality: e.target.value })} />
          </label>
          <label className={label}>How your pictures are shown
            <select className={input} value={f.treatment} onChange={(e) => set({ treatment: e.target.value as EditorInitial["treatment"] })}>
              <option value="photo">One main picture</option><option value="mosaic">A mosaic of three</option><option value="brand">No picture — a branded card</option>
            </select>
          </label>
        </div>

        {f.gallery.length > 0 && (
          <div>
            <p className={label}>Pictures from your website <span className="font-normal text-ink-muted">— untick any you don’t want. They’re linked from your own site, never copied.</span></p>
            <ul className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {f.gallery.map((g) => (
                <li key={g.src} className="rounded-xl border border-line p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.src} alt={g.alt} referrerPolicy="no-referrer" className="aspect-square w-full rounded-lg object-cover" />
                  <label className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                    <input type="checkbox" checked={f.keepGallery.includes(g.src)} onChange={(e) => set({ keepGallery: e.target.checked ? [...f.keepGallery, g.src] : f.keepGallery.filter((x) => x !== g.src) })} /> Keep
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-lg font-bold text-ink">Your story</p>
            {f.story ? <button type="button" onClick={() => set({ story: null })} className="rounded-pill px-3 py-1 text-sm font-semibold text-rose-600 hover:bg-rose-50">Remove</button>
              : <button type="button" onClick={() => set({ story: { title: "About us", body: "" } })} className="rounded-pill border border-line-strong px-3 py-1 text-sm font-semibold text-ink-soft hover:bg-sand">Add a story</button>}
          </div>
          {f.story && (
            <div className="mt-2 space-y-3">
              <label className={label}>Title<input className={input} value={f.story.title} maxLength={200} onChange={(e) => set({ story: { ...f.story!, title: e.target.value } })} /></label>
              <label className={label}>Text <span className="font-normal text-ink-muted">(a blank line starts a new paragraph)</span><textarea className={input} rows={6} value={f.story.body} onChange={(e) => set({ story: { ...f.story!, body: e.target.value } })} /></label>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-lg font-bold text-ink">What you offer, and useful information</p>
            {f.useful.length < 6 && !locked && <button type="button" onClick={() => set({ useful: [...f.useful, { title: "", body: "" }] })} className="rounded-pill border border-line-strong px-3 py-1 text-sm font-semibold text-ink-soft hover:bg-sand">Add a section</button>}
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">Text only. These describe what you do; they don’t create products, services or prices on OneShetland.</p>
          <div className="mt-3 space-y-4">
            {f.useful.map((u, i) => (
              <div key={i} className="space-y-2 rounded-lg bg-cream/60 p-3">
                <label className={label}>Title<input className={input} value={u.title} maxLength={200} onChange={(e) => set({ useful: f.useful.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} /></label>
                <label className={label}>Text<textarea className={input} rows={4} value={u.body} onChange={(e) => set({ useful: f.useful.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} /></label>
                <button type="button" onClick={() => set({ useful: f.useful.filter((_, j) => j !== i) })} className="rounded-pill px-3 py-1 text-sm font-semibold text-rose-600 hover:bg-rose-50">Remove this section</button>
              </div>
            ))}
            {f.useful.length === 0 && <p className="text-sm text-ink-muted">None yet.</p>}
          </div>
        </div>

        {!locked && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={!dirty || !!busy} className="rounded-pill bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">{busy === "save" ? "Saving…" : "Save changes"}</button>
            {dirty && <span className="text-sm font-semibold text-amber-700">Unsaved changes</span>}
          </div>
        )}
      </fieldset>

      <section aria-labelledby="approve-h" className="rounded-card border-2 border-line bg-paper p-5 shadow-soft">
        <h2 id="approve-h" className="font-display text-xl font-bold text-ink">{locked ? "You’ve approved your setup" : "Happy with it?"}</h2>
        {locked
          ? <p className="mt-1 text-sm text-ink-soft">Approved{approvedAt ? ` on ${new Date(approvedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}. Nothing is public yet; we’ll let you know when you can go live.</p>
          : <>
              <p className="mt-1 text-sm text-ink-soft">Approving tells us this is the page you want. <strong>It does not publish anything</strong> — your page and content stay private until you choose to go live.</p>
              <button type="button" onClick={approve} disabled={dirty || !!busy} className="mt-3 rounded-pill bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">{busy === "approve" ? "Approving…" : "Approve my setup"}</button>
              {dirty && <p className="mt-2 text-sm text-amber-700">Save your changes first, so you approve exactly what you’ve written.</p>}
            </>}
      </section>
      {msg && <p role={msg.ok ? "status" : "alert"} className={"text-sm font-semibold " + (msg.ok ? "text-emerald-700" : "text-rose-700")}>{msg.text}</p>}
    </div>
  );
}
