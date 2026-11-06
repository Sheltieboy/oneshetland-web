"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACTIVITY_CATEGORIES, BOOKING_MODES, validateActivityDraft, type ActivityDraft } from "@/lib/activities";
import { createActivity, updateActivity, emptyDraft, uploadActivityPhoto } from "@/lib/activities-client";
import { ActivityPhotoField } from "./ActivityPhotoField";
import { btnPrimary, card, hint, input, label } from "./ui";

/**
 * The activity's details: what it is, where, how people join and what it costs. Free for organisers; booking and payment are never required,
 * drop-in is the default. Used to create (then it opens the editor) and to edit.
 */
export function ActivityForm({ owner, base, activityId, initial, areas, coverUrl }: { coverUrl?: string | null; owner: { kind: "business" | "hub" | "platform"; id: string }; base: string; activityId?: string; initial?: ActivityDraft; areas: readonly { key: string; label: string }[] }) {
  const router = useRouter();
  const [d, setD] = useState<ActivityDraft>(initial ?? emptyDraft());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [showErr, setShowErr] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const check = validateActivityDraft(d);
  const set = (k: keyof ActivityDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setD((x) => ({ ...x, [k]: e.target.value }));
  const err = (k: string) => (showErr && check.errors[k] ? <p role="alert" className="mt-1 text-xs font-semibold text-rose-700">{check.errors[k]}</p> : null);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setShowErr(true); setMsg(null);
    if (!check.ok) return;
    setBusy(true);
    try {
      if (activityId) { await updateActivity(activityId, d); setMsg({ tone: "ok", text: "Saved." }); router.refresh(); }
      else {
        const a = await createActivity(owner, d);
        let failed = false;
        if (photo) { try { await uploadActivityPhoto(a.id, photo); } catch { failed = true; } }
        router.push(`${base}/${a.id}${failed ? "?photo=failed" : ""}`);
      }
    } catch (x) { setMsg({ tone: "err", text: (x as Error).message }); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className={card + " space-y-4"} noValidate>
      <div>
        <label className={label} htmlFor="ra-title">Name</label>
        <input id="ra-title" className={input} value={d.title} onChange={set("title")} maxLength={120} placeholder="e.g. Barre, Tai Chi, Bressay Under 5s" aria-invalid={!!(showErr && check.errors.title)} />
        {err("title")}
        <p className={hint}>One listing per activity. If you run Barre and Tai Chi, make two, each with its own days and times.</p>
      </div>
      <ActivityPhotoField activityId={activityId} coverUrl={coverUrl} pending={photo} onPending={setPhoto} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="ra-cat">Kind of activity</label>
          <select id="ra-cat" className={input} value={d.category} onChange={set("category")}>{ACTIVITY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>{err("category")}</div>
        <div><label className={label} htmlFor="ra-aud">Who is it for? <span className="font-normal text-ink-muted">(optional)</span></label>
          <input id="ra-aud" className={input} value={d.audience} onChange={set("audience")} maxLength={80} placeholder="e.g. Under 5s, Adults, Over 50s" />{err("audience")}</div>
      </div>
      <div>
        <label className={label} htmlFor="ra-desc">About <span className="font-normal text-ink-muted">(optional)</span></label>
        <textarea id="ra-desc" className={input} rows={4} value={d.description} onChange={set("description")} maxLength={4000} placeholder="What happens, what to bring, who runs it." />{err("description")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="ra-venue">Venue</label><input id="ra-venue" className={input} value={d.venue} onChange={set("venue")} maxLength={160} placeholder="e.g. Speldiburn" />{err("venue")}</div>
        <div><label className={label} htmlFor="ra-loc">Area</label>
          <input id="ra-loc" className={input} list="ra-areas" value={d.locality} onChange={set("locality")} maxLength={80} placeholder="e.g. Lerwick" />
          <datalist id="ra-areas">{areas.map((a) => <option key={a.key} value={a.label} />)}</datalist>{err("locality")}</div>
      </div>
      <fieldset className="space-y-3">
        <legend className={label}>How do people join?</legend>
        {BOOKING_MODES.map((m) => (
          <label key={m.value} className="flex items-start gap-2 text-sm text-ink">
            <input type="radio" name="booking_mode" value={m.value} checked={d.booking_mode === m.value} onChange={set("booking_mode")} className="mt-1" />
            <span>{m.label}{m.value === "drop_in" && <span className="ml-1 text-ink-muted">(the usual choice: nothing to set up)</span>}</span>
          </label>
        ))}
        {d.booking_mode === "link" && <div><label className={label} htmlFor="ra-url">Booking link</label><input id="ra-url" className={input} value={d.booking_url} onChange={set("booking_url")} placeholder="https://" inputMode="url" />{err("booking_url")}</div>}
        <div><label className={label} htmlFor="ra-contact">{d.booking_mode === "contact" ? "How to get in touch" : "Contact details"} {d.booking_mode !== "contact" && <span className="font-normal text-ink-muted">(optional)</span>}</label>
          <textarea id="ra-contact" className={input} rows={2} value={d.contact_info} onChange={set("contact_info")} maxLength={300} placeholder="Phone, email or a Facebook page" />{err("contact_info")}</div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className={label} htmlFor="ra-price">Cost <span className="font-normal text-ink-muted">(optional)</span></label><input id="ra-price" className={input} value={d.price_text} onChange={set("price_text")} maxLength={80} placeholder="Free · Small donation · £6 drop-in" />{err("price_text")}</div>
        <div><label className={label} htmlFor="ra-from">Starts <span className="font-normal text-ink-muted">(optional)</span></label><input id="ra-from" type="date" className={input} value={d.active_from} onChange={set("active_from")} /></div>
        <div><label className={label} htmlFor="ra-until">Ends <span className="font-normal text-ink-muted">(optional)</span></label><input id="ra-until" type="date" className={input} value={d.active_until} onChange={set("active_until")} />{err("active_until")}</div>
      </div>
      <p className={hint}>Leave the dates empty for an ongoing activity. Payments are not needed to list an activity.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Saving…" : activityId ? "Save details" : "Create activity"}</button>
        {!activityId && <span className="text-sm text-ink-muted">It starts as a draft: add the days and times next, then publish.</span>}
        {msg && <span role={msg.tone === "err" ? "alert" : "status"} className={"text-sm font-semibold " + (msg.tone === "err" ? "text-rose-700" : "text-emerald-700")}>{msg.text}</span>}
      </div>
    </form>
  );
}
