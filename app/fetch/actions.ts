"use server";

import { revalidatePath } from "next/cache";
import { fetchApi } from "@/lib/fetch/transport.server";
import { headerSummary, type HeaderSummary } from "@/lib/fetch/header";
import type { ApplyInput, CreateInput, FetchResult, IssueKind, PhotoKind, QuoteInput, ReleaseReason, RunInput, UndeliverableReason } from "@/lib/fetch-api";

/**
 * Fetch v2 — member server actions (Step 11). Each is one call through lib/fetch-api.ts with the member's own session; the database
 * and edge functions decide and record everything. What comes back is the server's answer (or its refusal, in plain English) —
 * screens never assume success.
 */
type R<T = unknown> = Promise<FetchResult<T>>;
const done = <T,>(r: FetchResult<T>, ...paths: string[]) => { if (r.ok) for (const p of paths) revalidatePath(p); return r; };
const job = (id: string) => [`/fetch/requests/${id}`, `/fetch/jobs/${id}`];

export async function confirmAdultAction(): R { return done(await (await fetchApi()).confirmAdult(), "/fetch"); }
export async function quoteAction(q: QuoteInput): R { return (await fetchApi()).quote(q); }
export async function createAction(c: CreateInput): R<{ request_id: string; already: boolean }> { return done(await (await fetchApi()).create(c), "/fetch", "/fetch/history"); }
export async function cancelOpenAction(id: string, reason?: string): R { return done(await (await fetchApi()).cancelOpen(id, reason), ...job(id)); }
export async function askToCancelAction(id: string, reason: string): R { return done(await (await fetchApi()).askToCancel(id, reason), ...job(id)); }
export async function extendAction(id: string): R { return done(await (await fetchApi()).extend(id), ...job(id)); }
export async function readyAction(id: string): R { return done(await (await fetchApi()).ready(id), ...job(id)); }
export async function paymentAction(id: string, action: "complete" | "refresh"): R<{ payment: string; client_secret?: string }> {
  return done(await (await fetchApi()).payment(id, action), ...job(id));
}

export async function applyAction(a: ApplyInput, areas: string[]): R<{ driver_status: string }> {
  const api = await fetchApi();
  const r = await api.apply(a);
  if (r.ok && areas.length) await api.setAreas(areas);
  return done(r, "/fetch/drive", "/fetch/driver/verification");
}
export async function setAreasAction(areas: string[]): R { return done(await (await fetchApi()).setAreas(areas), "/fetch/drive"); }
export async function setVehicleAction(v: { vehicle_class: string; max_size_class: string; vehicle_reg?: string; can_two_person_lift?: boolean }): R {
  return done(await (await fetchApi()).setVehicle(v), "/fetch/driver/verification", "/fetch/drive");
}
export async function evidenceBeginAction(kind: string, mime: string, size: number): R { return (await fetchApi()).evidenceBeginUpload(kind, mime, size); }
export async function evidenceSubmitAction(uploadId: string): R { return done(await (await fetchApi()).evidenceSubmit(uploadId), "/fetch/driver/verification"); }
export async function evidenceViewAction(itemId: string): R<{ url: string }> { return (await fetchApi()).evidenceView(itemId); }
export async function createRunAction(r: RunInput): R { return done(await (await fetchApi()).createRun(r), "/fetch/drive", "/fetch/board"); }
export async function cancelRunAction(id: string): R { return done(await (await fetchApi()).cancelRun(id), "/fetch/drive", "/fetch/board"); }
export async function acceptAction(id: string, vehicleConfirmed: boolean): R<{ payment: string; can_collect: boolean; payment_reason?: string }> {
  return done(await (await fetchApi()).accept(id, vehicleConfirmed), "/fetch/board", "/fetch/drive", `/fetch/jobs/${id}`);
}
export async function arrivedAction(id: string): R { return done(await (await fetchApi()).arrived(id), ...job(id)); }
export async function collectedAction(id: string): R { return done(await (await fetchApi()).collected(id), ...job(id)); }
export async function refreshHoldAction(id: string): R { return done(await (await fetchApi()).refreshHold(id), ...job(id)); }
export async function releaseAction(id: string, reason: ReleaseReason, note?: string): R { return done(await (await fetchApi()).release(id, reason, note), ...job(id), "/fetch/drive"); }
export async function agreeToCancelAction(id: string): R { return done(await (await fetchApi()).agreeToCancel(id), ...job(id)); }
export async function declineToCancelAction(id: string, note?: string): R { return done(await (await fetchApi()).declineToCancel(id, note), ...job(id)); }
export async function deliverAction(id: string, safePlace: boolean): R { return done(await (await fetchApi()).deliver(id, safePlace), ...job(id), "/fetch/drive"); }
export async function cannotDeliverAction(id: string, reason: UndeliverableReason, note?: string): R { return done(await (await fetchApi()).cannotDeliver(id, reason, note), ...job(id)); }
export async function reportReturnAction(id: string, note?: string): R { return done(await (await fetchApi()).reportReturn(id, note), ...job(id)); }

export async function messagesAction(id: string): R<{ can_send: boolean; messages: import("@/lib/fetch-api").Message[] }> { return (await fetchApi()).messages(id); }
export async function sendMessageAction(id: string, body: string, ref: string): R { return (await fetchApi()).sendMessage(id, body, ref); }
export async function reportProblemAction(id: string, kind: IssueKind, detail: string, ref: string): R<{ issue_id: string }> {
  return done(await (await fetchApi()).reportProblem(id, kind, detail, ref), ...job(id));
}
export async function setItemPhotoAction(id: string, photoId: string, action: "show_on_board" | "hide_from_board" | "withdraw"): R {
  return done(await (await fetchApi()).setItemPhoto(id, photoId, action), ...job(id));
}
export async function photoBeginAction(id: string, kind: PhotoKind, mime: string, size: number, opts: { issueId?: string; showOnBoard?: boolean } = {}): R {
  return (await fetchApi()).photoBeginUpload(id, kind, mime, size, opts);
}
export async function photoSubmitAction(id: string, uploadId: string): R { return done(await (await fetchApi()).photoSubmit(uploadId), ...job(id)); }
export async function photoViewAction(photoId: string, board = false): R<{ url: string }> { return (await fetchApi()).photoView(photoId, board); }

/** The header chip refreshes through this (no browser client, no table subscription). */
export async function headerSummaryAction(): Promise<HeaderSummary> {
  const r = await (await fetchApi()).myRequests().catch(() => null);
  return r?.ok ? headerSummary(r.data) : null;
}

