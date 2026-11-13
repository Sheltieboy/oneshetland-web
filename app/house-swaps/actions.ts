"use server";

/**
 * Server actions for House Swaps. Every call runs on the signed-in member's own Supabase session, so the database decides who may do what; there is
 * deliberately no privileged admin client here. A refusal comes back in the database's own plain words and is shown to the person, never swallowed.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/notices-rpc";
import { houseSwapsEnabled } from "@/lib/house-swaps-data";
import {
  REPORT_REASON_IDS, advertPayload, isUuid, validateAdvert, validateMessage, hasContactDetails, CONTACT_RULE, LIMITS,
  type AdvertErrors, type AdvertForm,
} from "@/lib/house-swaps";

export type ActionState = { status: "idle" | "ok" | "error"; message?: string; at?: number };
const ok = (message: string): ActionState => ({ status: "ok", message, at: Date.now() });
const fail = (message: string): ActionState => ({ status: "error", message, at: Date.now() });
const text = (fd: FormData, k: string): string => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");

async function session() {
  if (!(await houseSwapsEnabled())) return null;
  return createClient();
}
const NOT_OPEN = "House Swaps is not open yet.";

export type SaveResult = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: AdvertErrors };

/** Create or update the member's one advert. */
export async function saveAdvert(form: AdvertForm): Promise<SaveResult> {
  const sb = await session();
  if (!sb) return { ok: false, error: NOT_OPEN };
  const v = validateAdvert(form);
  if (!v.ok) return { ok: false, error: "Please check the highlighted parts of the form.", fieldErrors: v.errors };
  const r = await callRpc<string>(sb, "upsert_my_house_swap", { p: advertPayload(form) });
  return r.ok ? { ok: true, id: r.data } : { ok: false, error: r.error };
}

/** Pause, resume or withdraw the member's advert. */
export async function setAdvertStatus(status: "active" | "paused" | "withdrawn"): Promise<ActionState> {
  const sb = await session();
  if (!sb) return fail(NOT_OPEN);
  if (!["active", "paused", "withdrawn"].includes(status)) return fail("Unknown option.");
  const r = await callRpc(sb, "set_my_house_swap_status", { p_status: status });
  if (!r.ok) return fail(r.error);
  return ok(status === "paused" ? "Your advert is paused." : status === "active" ? "Your advert is back on the noticeboard (if it has been approved)." : "Your advert has been withdrawn.");
}

export async function confirmAdvert(): Promise<ActionState> {
  const sb = await session();
  if (!sb) return fail(NOT_OPEN);
  const r = await callRpc(sb, "confirm_my_house_swap");
  return r.ok ? ok("Thank you. Your advert will show for another 90 days.") : fail(r.error);
}

/** Express interest: starts a private conversation and takes the member straight to it. */
export async function sendEnquiry(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const sb = await session();
  if (!sb) return fail(NOT_OPEN);
  const listing = text(fd, "listing"), message = text(fd, "message");
  if (!isUuid(listing)) return fail("That advert could not be found.");
  const bad = validateMessage(message);
  if (bad) return fail(bad);
  const r = await callRpc<string>(sb, "start_house_swap_thread", { p_listing: listing, p_message: message.trim() });
  if (!r.ok) return fail(r.error);
  redirect(`/house-swaps/messages/${r.data}?sent=1`);
}

export async function sendReply(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const sb = await session();
  if (!sb) return fail(NOT_OPEN);
  const thread = text(fd, "thread"), body = text(fd, "body");
  if (!isUuid(thread)) return fail("That conversation could not be found.");
  const bad = validateMessage(body);
  if (bad) return fail(bad);
  const r = await callRpc(sb, "send_house_swap_message", { p_thread: thread, p_body: body.trim() });
  return r.ok ? ok("Sent.") : fail(r.error);
}

/** Close a conversation, optionally blocking the other member (their adverts and messages then disappear for each other). */
export async function closeThread(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const sb = await session();
  if (!sb) return fail(NOT_OPEN);
  const thread = text(fd, "thread"), block = text(fd, "block") === "1";
  if (!isUuid(thread)) return fail("That conversation could not be found.");
  const r = await callRpc(sb, "close_house_swap_thread", { p_thread: thread, p_block: block });
  if (!r.ok) return fail(r.error);
  if (block) redirect("/house-swaps/messages?blocked=1");
  return ok("This conversation is closed.");
}

export async function reportContent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const sb = await session();
  if (!sb) return fail(NOT_OPEN);
  const kind = text(fd, "kind"), id = text(fd, "id"), reason = text(fd, "reason"), details = text(fd, "details").trim();
  if (kind !== "listing" && kind !== "thread") return fail("Unknown report type.");
  if (!isUuid(id)) return fail("That could not be found.");
  if (!REPORT_REASON_IDS.includes(reason)) return fail("Please choose a reason.");
  if (details.length > LIMITS.report) return fail(`Please keep the details to ${LIMITS.report} characters.`);
  if (hasContactDetails(details)) return fail(CONTACT_RULE);
  const r = await callRpc(sb, "report_house_swap", { p_kind: kind, p_id: id, p_reason: reason, p_details: details || null });
  return r.ok ? ok("Thank you. Our team will take a look. You don't need to do anything else.") : fail(r.error);
}

/** Staff decision on an advert. The database refuses anyone who is not staff. */
export async function moderateAdvert(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const sb = await session();
  if (!sb) return fail(NOT_OPEN);
  const listing = text(fd, "listing"), decision = text(fd, "decision"), reason = text(fd, "reason").trim();
  if (!isUuid(listing)) return fail("That advert could not be found.");
  if (!["approve", "reject", "hide"].includes(decision)) return fail("Unknown decision.");
  if (decision !== "approve" && !reason) return fail("Please give the member a short reason.");
  if (reason.length > LIMITS.reason) return fail(`Please keep the reason to ${LIMITS.reason} characters.`);
  const r = await callRpc(sb, "admin_house_swap_decide", { p_listing: listing, p_decision: decision, p_reason: reason || null });
  if (!r.ok) return fail(r.error);
  const done = decision === "approve" ? "Approved." : decision === "reject" ? "Rejected. The member can see your reason." : "Hidden.";
  // The advert leaves this list once decided, so confirm on the refreshed page.
  const tab = ["pending", "reported", "hidden", "rejected", "approved"].includes(text(fd, "tab")) ? text(fd, "tab") : "pending";
  redirect(`/house-swaps/moderate?tab=${tab}&done=${encodeURIComponent(done)}`);
}

const EMAIL_SHAPE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Staff: invite a preview reviewer by email. The database refuses anyone who is not staff; the invited person may not have an account yet. */
export async function inviteReviewer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const sb = await session();
  if (!sb) return fail(NOT_OPEN);
  const email = text(fd, "email").trim().toLowerCase(), note = text(fd, "note").trim();
  if (!EMAIL_SHAPE.test(email) || email.length > 254) return fail("Please enter a full email address.");
  if (note.length > 200) return fail("Please keep the note to 200 characters.");
  const r = await callRpc(sb, "admin_house_swap_invite_add", { p_email: email, p_note: note || null });
  return r.ok ? ok(`${email} is invited.`) : fail(r.error);
}

/** Staff: take a reviewer's access away (their own adverts stay until staff remove them in the database). */
export async function removeReviewer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const sb = await session();
  if (!sb) return fail(NOT_OPEN);
  const email = text(fd, "email").trim().toLowerCase();
  if (!EMAIL_SHAPE.test(email)) return fail("That email address could not be read.");
  const r = await callRpc(sb, "admin_house_swap_invite_remove", { p_email: email });
  return r.ok ? ok(`${email} no longer has access.`) : fail(r.error);
}
