"use client";

/**
 * activities-client.ts — what an organiser's browser writes. Every call runs as the signed-in person; the database (row security, the owner
 * guard, the exception guard) decides what is allowed. Nothing here is an authority, so a rejected write simply surfaces the database's reason.
 */
import { createClient } from "@/lib/supabase/client";
import { londonInstant, type ActivityDraft } from "@/lib/activities";

const nul = (v: string) => (v.trim() === "" ? null : v.trim());
const fail = (e: unknown): never => { throw new Error((e as { message?: string })?.message ?? "Something went wrong. Please try again."); };

export const emptyDraft = (): ActivityDraft => ({ title: "", description: "", category: "fitness", audience: "", venue: "", locality: "", price_text: "", booking_mode: "drop_in", contact_info: "", booking_url: "", active_from: "", active_until: "" });

const rowFrom = (d: ActivityDraft) => ({
  title: d.title.trim(), description: nul(d.description), category: d.category, audience: nul(d.audience), venue: nul(d.venue), locality: nul(d.locality),
  price_text: nul(d.price_text), booking_mode: d.booking_mode, contact_info: nul(d.contact_info), booking_url: d.booking_mode === "link" ? nul(d.booking_url) : null,
  active_from: nul(d.active_from), active_until: nul(d.active_until),
});

export async function createActivity(owner: { kind: "business" | "hub" | "platform"; id: string }, d: ActivityDraft): Promise<{ id: string; slug: string }> {
  const { data, error } = await createClient().from("regular_activities")
    .insert({ ...rowFrom(d), status: "draft", ...(owner.kind === "platform" ? { is_platform_activity: true } : owner.kind === "business" ? { organiser_business_id: owner.id } : { organiser_hub_id: owner.id }) })
    .select("id, slug").single();
  if (error) fail(error);
  return data as { id: string; slug: string };
}
export async function updateActivity(id: string, d: ActivityDraft) {
  const { error } = await createClient().from("regular_activities").update(rowFrom(d)).eq("id", id);
  if (error) fail(error);
}
export async function setActivityStatus(id: string, status: "draft" | "published" | "ended") {
  const { error } = await createClient().from("regular_activities").update({ status }).eq("id", id);
  if (error) fail(error);
}
export async function deleteActivity(id: string) {
  const { error } = await createClient().from("regular_activities").delete().eq("id", id);
  if (error) fail(error);
}

/** One rule per ticked day, same times. */
export async function addRules(activityId: string, days: number[], start: string, end: string, intervalWeeks = 1) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const { error } = await createClient().from("activity_schedule_rules").insert(days.map((d) => ({ activity_id: activityId, day_of_week: d, start_time: start, end_time: end, interval_weeks: intervalWeeks, anchor_date: today })));
  if (error) fail(error);
}
export async function deleteRule(id: string) {
  const { error } = await createClient().from("activity_schedule_rules").delete().eq("id", id);
  if (error) fail(error);
}

export async function cancelSession(activityId: string, ruleId: string, occurrenceDate: string, note: string) {
  const { error } = await createClient().from("activity_exceptions").insert({ activity_id: activityId, rule_id: ruleId, occurrence_date: occurrenceDate, kind: "cancelled", note: nul(note) });
  if (error) fail(error);
}
export type SessionChange = { date?: string; start?: string; end?: string; venue?: string; note?: string };
/** Move, retime, relocate or annotate ONE session. `date`/`start`/`end` are London wall-clock values. */
export async function changeSession(activityId: string, ruleId: string, occurrenceDate: string, c: SessionChange, existingExceptionId?: string | null) {
  const row = {
    kind: "changed" as const,
    new_starts_at: c.date && c.start ? londonInstant(c.date, c.start) : null,
    new_ends_at: c.date && c.start && c.end ? londonInstant(c.date, c.end) : null,
    new_venue: nul(c.venue ?? ""), note: nul(c.note ?? ""),
  };
  const sb = createClient();
  const { error } = existingExceptionId
    ? await sb.from("activity_exceptions").update(row).eq("id", existingExceptionId)
    : await sb.from("activity_exceptions").insert({ activity_id: activityId, rule_id: ruleId, occurrence_date: occurrenceDate, ...row });
  if (error) fail(error);
}
/** Put a cancelled or changed session back to normal. */
export async function restoreSession(exceptionId: string) {
  const { error } = await createClient().from("activity_exceptions").delete().eq("id", exceptionId);
  if (error) fail(error);
}
export async function addExtraSession(activityId: string, date: string, start: string, end: string, venue: string, note: string) {
  const { error } = await createClient().from("activity_exceptions").insert({ activity_id: activityId, kind: "extra", new_starts_at: londonInstant(date, start), new_ends_at: londonInstant(date, end), new_venue: nul(venue), note: nul(note) });
  if (error) fail(error);
}

/** A holiday break; with `activityIds` it is added to each of the organiser's activities in one go. */
export async function addBreak(activityIds: string[], start: string, end: string, reason: string) {
  const { error } = await createClient().from("activity_breaks").insert(activityIds.map((id) => ({ activity_id: id, start_date: start, end_date: end, reason: nul(reason) })));
  if (error) fail(error);
}
export async function deleteBreak(id: string) {
  const { error } = await createClient().from("activity_breaks").delete().eq("id", id);
  if (error) fail(error);
}

/* ── Main photograph ──────────────────────────────────────────────────────────────────────────────────────────────────────── */
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Quick checks for the person choosing a file (the server repeats them on the bytes). Returns a plain-English problem, or null. */
export function photoProblem(f: File): string | null {
  if (!PHOTO_TYPES.includes(f.type)) return "Use a JPEG, PNG or WebP photo.";
  return null;
}

/**
 * Phone photos are often 4 to 10 MB. Shrink big ones in the browser first (longest side 2000px, WebP) so the upload is fast and stays under the
 * 5 MB request limit. If the browser can't do it, the original goes up unchanged and the server decides.
 */
export async function prepareActivityPhoto(file: File): Promise<File> {
  try {
    if (file.size <= 1.5 * 1024 * 1024 && file.type === "image/webp") return file;
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size <= 3 * 1024 * 1024) { bmp.close(); return file; }
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/webp", 0.85));
    return blob && blob.size < file.size ? new File([blob], "photo.webp", { type: "image/webp" }) : file;
  } catch { return file; }
}

async function photoCall(id: string, init: RequestInit): Promise<string | null> {
  const res = await fetch(`/api/activities/${id}/image`, { ...init, credentials: "same-origin" });
  const body = (await res.json().catch(() => ({}))) as { cover_url?: string | null; error?: string };
  if (!res.ok) throw new Error(body.error ?? (res.status === 413 ? "That photo is too large. Choose a smaller one." : "The photo could not be saved. Please try again."));
  return body.cover_url ?? null;
}
export async function uploadActivityPhoto(id: string, file: File): Promise<string | null> {
  const bad = photoProblem(file); if (bad) throw new Error(bad);
  const body = new FormData(); body.append("file", await prepareActivityPhoto(file));
  return photoCall(id, { method: "POST", body });
}
export const removeActivityPhoto = (id: string) => photoCall(id, { method: "DELETE" });
