"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-data.server";
import { buildAdminRequest } from "@/lib/fetch-admin/actions";
import { callFetchAdmin } from "@/lib/fetch-admin/edge.server";

/**
 * Fetch operations — server actions (docs/FETCH_V2_IMPLEMENTATION.md, Step 10). Each checks the caller is an administrator, builds the
 * request from the action registry (lib/fetch-admin/actions.ts), and sends it to fetch-v2-admin, which checks again and records the
 * change. Nothing here writes a table. The result returned is the server's.
 */
export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function runFetchAdminAction(id: string, input: { target: string; reason?: string; fields?: Record<string, string> }): Promise<ActionResult> {
  await requireAdmin();
  const built = buildAdminRequest(id, input);
  if (!built.ok) return built;
  const r = await callFetchAdmin(built.body);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/fetch", "layout");
  return { ok: true, message: r.body.already ? "Already done — nothing changed." : "Done. The page now shows the recorded result." };
}

/** A 2-minute link to a job photo (fetch-v2-admin support view_photo). The link is handed to the browser to open; it is never stored. */
export async function photoLinkAction(photoId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(photoId)) return { ok: false, error: "Unknown photo." };
  const r = await callFetchAdmin({ area: "support", action: "view_photo", photo_id: photoId });
  return r.ok && typeof r.body.url === "string" ? { ok: true, url: r.body.url } : { ok: false, error: r.ok ? "No link was returned." : r.error };
}

/** A 2-minute link to a driver's verification document (fetch-v2-admin drivers view_evidence; each view is recorded). */
export async function evidenceLinkAction(itemId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return { ok: false, error: "Unknown document." };
  const r = await callFetchAdmin({ area: "drivers", action: "view_evidence", item_id: itemId });
  return r.ok && typeof r.body.url === "string" ? { ok: true, url: r.body.url } : { ok: false, error: r.ok ? "No link was returned." : r.error };
}
