/**
 * accessibility-data.ts — server-side reads for Accessible Shetland.
 *
 * Every read is bounded and indexed. Visitor-facing reads use the anonymous client so row security shows exactly what the public may see
 * (published, not hidden, and the listing itself is public). A failed read returns "nothing", never an error page: this feature must not be
 * able to take a business, Hub or event page down.
 */
import { publicClient } from "./supabase/public";
import { createClient } from "./supabase/server";
import { isSubjectType, subjectHref, type Fact, type Profile, type ProfileWithFacts, type SubjectType } from "./accessibility";

const PROFILE_COLS = "subject_type, subject_id, published, summary, visit_tips, access_contact, last_confirmed_at, updated_at, last_editor_kind, verification, verification_note, verified_on";

/** What the public sees for one listing, or null. Two small indexed reads. */
export async function getPublicAccessibility(type: SubjectType, id: string): Promise<ProfileWithFacts | null> {
  try {
    const sb = publicClient();
    const { data: p } = await sb.from("accessibility_profiles").select(PROFILE_COLS).eq("subject_type", type).eq("subject_id", id).maybeSingle();
    if (!p) return null;
    const { data: f } = await sb.from("accessibility_facts").select("facility, status, detail").eq("subject_type", type).eq("subject_id", id).limit(60);
    return { ...(p as Profile), facts: (f ?? []) as Fact[] };
  } catch { return null; }
}

/** The signed-in editor's own view, drafts included. Row security decides whether they may see it at all. */
export async function getEditableAccessibility(type: SubjectType, id: string): Promise<ProfileWithFacts | null> {
  try {
    const sb = await createClient();
    const { data: p } = await sb.from("accessibility_profiles").select(`${PROFILE_COLS}, hidden_by_staff, hidden_reason`).eq("subject_type", type).eq("subject_id", id).maybeSingle();
    if (!p) return null;
    const { data: f } = await sb.from("accessibility_facts").select("facility, status, detail").eq("subject_type", type).eq("subject_id", id).limit(60);
    return { ...(p as Profile), facts: (f ?? []) as Fact[] };
  } catch { return null; }
}

/** Can the signed-in person edit this listing? Asks the same database rule the save uses. */
export async function canEditAccessibility(type: SubjectType, id: string): Promise<boolean> {
  try {
    const sb = await createClient();
    const { data } = await sb.rpc("accessibility_can_edit", { p_type: type, p_id: id });
    return data === true;
  } catch { return false; }
}

export type BrowseItem = { type: SubjectType; id: string; name: string; href: string; place: string | null; summary: string | null; updated_at: string; verification: Profile["verification"]; facts: Fact[] };
export const BROWSE_LIMIT = 120;

/** Published listings for /accessible: at most BROWSE_LIMIT profiles, then one batched name read per type and one facts read. 6 queries however many there are. */
export async function listPublishedAccessibility(): Promise<BrowseItem[]> {
  try {
    const sb = publicClient();
    const { data: ps } = await sb.from("accessibility_profiles").select(PROFILE_COLS).order("updated_at", { ascending: false }).limit(BROWSE_LIMIT);
    const profiles = (ps ?? []) as Profile[];
    if (profiles.length === 0) return [];
    const ids = (t: SubjectType) => profiles.filter((p) => p.subject_type === t).map((p) => p.subject_id);
    const [biz, hubs, acts, evs, facts] = await Promise.all([
      ids("business").length ? sb.from("local_businesses_public").select("id, name, slug, address").in("id", ids("business")) : { data: [] },
      ids("hub").length ? sb.from("hubs").select("id, name, slug").in("id", ids("hub")) : { data: [] },
      ids("activity").length ? sb.from("regular_activities").select("id, title, slug, locality").in("id", ids("activity")) : { data: [] },
      ids("event").length ? sb.from("events").select("id, title, venue").in("id", ids("event")) : { data: [] },
      sb.from("accessibility_facts").select("subject_type, subject_id, facility, status, detail").in("subject_id", profiles.map((p) => p.subject_id)).limit(BROWSE_LIMIT * 30),
    ]);
    type N = { id: string; name?: string; title?: string; slug?: string | null; locality?: string | null; address?: string | null; venue?: string | null };
    const names = new Map<string, N>();
    for (const [t, rows] of [["business", biz.data], ["hub", hubs.data], ["activity", acts.data], ["event", evs.data]] as const) for (const r of (rows ?? []) as N[]) names.set(`${t}:${r.id}`, r);
    const byFacts = new Map<string, Fact[]>();
    for (const f of (facts.data ?? []) as (Fact & { subject_type: string; subject_id: string })[]) {
      if (!isSubjectType(f.subject_type)) continue;
      const k = `${f.subject_type}:${f.subject_id}`; (byFacts.get(k) ?? byFacts.set(k, []).get(k)!).push({ facility: f.facility, status: f.status, detail: f.detail });
    }
    return profiles.flatMap((p) => {
      const n = names.get(`${p.subject_type}:${p.subject_id}`);
      const name = n?.name ?? n?.title;
      if (!n || !name) return [];             // the listing itself is not public (or gone): show nothing rather than a nameless card
      return [{ type: p.subject_type, id: p.subject_id, name, href: subjectHref(p.subject_type, p.subject_id, n.slug), place: n.locality ?? n.venue ?? n.address ?? null, summary: p.summary, updated_at: p.updated_at, verification: p.verification, facts: byFacts.get(`${p.subject_type}:${p.subject_id}`) ?? [] }];
    });
  } catch { return []; }
}

/** A subject's name and public link, read as the signed-in person (so only what they may see). */
export async function getSubjectLabel(type: SubjectType, id: string): Promise<{ name: string; href: string; manage: string } | null> {
  try {
    const sb = await createClient();
    if (type === "business") { const { data } = await sb.from("local_businesses").select("id, name, slug").eq("id", id).maybeSingle(); return data ? { name: data.name, href: subjectHref("business", id, data.slug), manage: `/business/${id}/manage` } : null; }
    if (type === "hub") { const { data } = await sb.from("hubs").select("id, name, slug").eq("id", id).maybeSingle(); return data ? { name: data.name, href: subjectHref("hub", id, data.slug), manage: `/hubs/${data.slug || id}/manage` } : null; }
    if (type === "activity") { const { data } = await sb.from("regular_activities").select("id, title, slug").eq("id", id).maybeSingle(); return data ? { name: data.title, href: subjectHref("activity", id, data.slug), manage: "/account" } : null; }
    const { data } = await sb.from("events").select("id, title").eq("id", id).maybeSingle();
    return data ? { name: data.title, href: subjectHref("event", id), manage: "/account" } : null;
  } catch { return null; }
}
