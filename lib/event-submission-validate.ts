/**
 * event-submission-validate.ts — checks a person's event details BEFORE they are sent, in friendly words.
 * It mirrors the database rules (migration 20261230010000) so most mistakes are caught on the page; the database stays the authority, and
 * anything it refuses is shown against the right field by the client module. Pure: no network, no clock (callers pass `now`).
 */
import { buildOccurrences, type DateRow, type UtcOccurrence, type RowIssue } from "./event-dates-builder";

export const ADULT_CONFIRM_TEXT = "I am 18 or over, and I have the organiser's permission to submit this";

/** The only place a poster may live: this project's event-media bucket, in the person's own folder. Mirrors the database check. */
export const COVER_URL_PREFIX = "https://nkrtmakxygkvxuxriiil.supabase.co/storage/v1/object/public/event-media/";

export const LIMITS = {
  organiser_name: 120, title: 200, description: 2000, venue: 200, locality: 100, price_text: 100, contact_info: 300, ticket_url: 500,
} as const;

export type FieldName =
  | "organiser_name" | "title" | "description" | "venue" | "locality" | "price_text" | "contact_info" | "ticket_url" | "cover_url" | "adult_confirmed" | "occurrences";

const LABELS: Record<string, string> = {
  organiser_name: "the group's name", title: "the event name", description: "the description", venue: "the place", locality: "the area",
  price_text: "the price", contact_info: "the contact details", ticket_url: "the ticket link",
};

/** Control characters out, ends trimmed. Descriptions keep their line breaks. */
export function cleanText(v: string, multiline = false): string {
  const t = multiline ? v.replace(/\r/g, "").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "") : v.replace(/[\x00-\x1f\x7f]/g, "");
  return t.replace(/^[\s]+|[\s]+$/g, "");
}

const WEB_TLDS = "com|co\\.uk|uk|org|net|scot|io|me|ly|info|biz|app|dev|link|gl|xyz|tk|site|online|shop|store|page|tv|eu|ie|us|ca|au|nz|fm|to|cc|ws|top|club|live|news|email|cloud";

/** The text rules (no links; no email or phone numbers except in contact details). Returns a friendly problem or null. */
export function textProblem(text: string, allowContact = false): string | null {
  if (/(https?:\/\/|ftp:\/\/|www\.)/i.test(text)) return "links";
  if (!allowContact && text.includes("@")) return "email";
  const q = allowContact ? text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, "") : text;
  if (new RegExp(`(^|[^a-z0-9-])[a-z0-9][a-z0-9-]*\\.(${WEB_TLDS})($|[^a-z0-9])`, "i").test(q)) return "web";
  if (!allowContact) {
    if (/\d{7,}/.test(text.replace(/[ ()]/g, "")) || /(\+|(^|[^0-9])00)\s?44/.test(text) || /(^|[^0-9])0[127]\d{8,9}($|[^0-9])/.test(text.replace(/[ ()-]/g, ""))) return "phone";
  }
  return null;
}

function friendlyTextProblem(field: string, kind: string): string {
  const where = field === "description" ? "the description" : LABELS[field] ?? "this box";
  if (kind === "links") return `Please take any links out of ${where}. If you have a ticket link, there is a separate box for it.`;
  if (kind === "email") return `Please take any email address out of ${where}. There is a separate box for contact details.`;
  if (kind === "web") return `Please take any web addresses out of ${where}. If you have a ticket link, there is a separate box for it.`;
  return `Please take any phone numbers out of ${where}. There is a separate box for contact details.`;
}

const REQUIRED_MSG: Record<string, string> = {
  organiser_name: "Please tell us which group or organiser this is for.",
  title: "Please give the event a name.",
  description: "Please say a little about the event.",
  venue: "Please tell us where it is.",
};

/** One text field -> { value } (cleaned, null if empty and optional) or { error }. */
export function checkField(field: Exclude<FieldName, "occurrences" | "cover_url" | "adult_confirmed">, raw: string): { value: string | null; error?: string } {
  const v = cleanText(raw ?? "", field === "description");
  if (!v) return REQUIRED_MSG[field] ? { value: null, error: REQUIRED_MSG[field] } : { value: null };
  if (v.length > LIMITS[field]) return { value: v, error: `That is a bit long for ${LABELS[field]}. Please keep it to ${LIMITS[field]} characters or fewer.` };
  if (field === "ticket_url") {
    if (!/^https:\/\/[^\s/]+(\/\S*)?$/.test(v)) return { value: v, error: "A ticket link needs to start with https://" };
    return { value: v };
  }
  const p = textProblem(v, field === "contact_info");
  if (p) return { value: v, error: friendlyTextProblem(field, p) };
  return { value: v };
}

export type SubmissionForm = {
  request_id: string;
  organiser_name: string;
  title: string;
  description: string;
  category: string;
  venue: string;
  locality: string;
  price_text: string;
  contact_info: string;
  ticket_url: string;
  cover_url: string | null;
  adult_confirmed: boolean;
  rows: DateRow[];
};

export type SubmissionPayload = {
  request_id: string; organiser_name: string; title: string; description: string; category: string; venue: string; locality: string | null;
  price_text: string | null; contact_info: string | null; ticket_url: string | null; cover_url: string | null; adult_confirmed: true; occurrences: UtcOccurrence[];
};

export type ValidationResult =
  | { ok: true; payload: SubmissionPayload; warnings: string[] }
  | { ok: false; errors: Partial<Record<FieldName, string>>; rowIssues: RowIssue[]; order: FieldName[] };

export const FIELD_ORDER: FieldName[] = ["organiser_name", "title", "description", "venue", "locality", "occurrences", "price_text", "contact_info", "ticket_url", "cover_url", "adult_confirmed"];

/** Which fields belong to which step, so each step can be checked on its own. */
export const STEP_FIELDS = {
  about: ["organiser_name", "title", "description"],
  where: ["venue", "locality"],
  when: ["occurrences"],
  more: ["price_text", "contact_info", "ticket_url", "cover_url"],
  review: ["adult_confirmed"],
} as const satisfies Record<string, readonly FieldName[]>;

export function validateSubmission(f: SubmissionForm, now: Date | number = new Date(), userId?: string | null): ValidationResult {
  const errors: Partial<Record<FieldName, string>> = {};
  const vals: Record<string, string | null> = {};
  for (const field of ["organiser_name", "title", "description", "venue", "locality", "price_text", "contact_info", "ticket_url"] as const) {
    const r = checkField(field, f[field]);
    vals[field] = r.value;
    if (r.error) errors[field] = r.error;
  }
  if (f.cover_url) {
    const ok = !!userId
      ? new RegExp(`^${COVER_URL_PREFIX.replace(/[.]/g, "\\.")}${userId}/events/[A-Za-z0-9._~%-]+$`).test(f.cover_url)
      : f.cover_url.startsWith(COVER_URL_PREFIX);
    if (!ok) errors.cover_url = "Please upload the poster again.";
  }
  if (!f.adult_confirmed) errors.adult_confirmed = "Please tick the box to confirm.";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(f.request_id)) errors.occurrences = "Something went wrong on this page. Please reload it and try again.";

  const built = buildOccurrences(f.rows, now);
  let rowIssues: RowIssue[] = [];
  if (!built.ok) {
    rowIssues = built.issues;
    errors.occurrences = built.general[0] ?? (built.issues.length ? "Please check the dates marked below." : "Add at least one date.");
  }

  if (Object.keys(errors).length || !built.ok) {
    return { ok: false, errors, rowIssues, order: FIELD_ORDER.filter((k) => errors[k]) };
  }
  return {
    ok: true,
    warnings: built.warnings,
    payload: {
      request_id: f.request_id.toLowerCase(),
      organiser_name: vals.organiser_name!, title: vals.title!, description: vals.description!, category: f.category,
      venue: vals.venue!, locality: vals.locality, price_text: vals.price_text, contact_info: vals.contact_info, ticket_url: vals.ticket_url,
      cover_url: f.cover_url || null, adult_confirmed: true, occurrences: built.occurrences,
    },
  };
}

/** Validate only some fields (one step at a time). */
export function validateStep(f: SubmissionForm, fields: readonly FieldName[], now: Date | number = new Date(), userId?: string | null): ValidationResult | { ok: true; payload: null; warnings: string[] } {
  const all = validateSubmission({ ...f, adult_confirmed: true }, now, userId);
  if (all.ok) return { ok: true, payload: null, warnings: all.warnings };
  const errors: Partial<Record<FieldName, string>> = {};
  for (const k of fields) if (all.errors[k]) errors[k] = all.errors[k];
  if (!Object.keys(errors).length) return { ok: true, payload: null, warnings: [] };
  return { ok: false, errors, rowIssues: fields.includes("occurrences") ? all.rowIssues : [], order: all.order.filter((k) => errors[k]) };
}

/** A poster file the bucket accepts (jpeg, png or webp, up to 10 MB). */
export const POSTER_MAX_BYTES = 10 * 1024 * 1024;
export function posterProblem(file: { type: string; size: number }): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Please choose a JPG, PNG or WebP picture.";
  if (file.size > POSTER_MAX_BYTES) return "That picture is too big. Please choose one under 10 MB.";
  return null;
}

/** A filename the database's cover-url rule accepts. */
export function posterFileName(originalName: string, type: string, stamp: number): string {
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  void originalName;
  return `cover-${stamp}.${ext}`;
}
