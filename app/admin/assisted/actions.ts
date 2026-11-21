"use server";
/**
 * Assisted Publishing — the two creation actions and the two housekeeping ones.
 *
 * Each starts with requireAdmin() and then calls exactly ONE database function, which checks the
 * caller again and does its own writing. Nothing here uses a service key. A duplicate answer is
 * returned to the screen rather than thrown, because it is a question for the administrator, not an
 * error.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-data.server";
import { createBusiness, createHub, forgetContact, setRequest } from "@/lib/assisted/client";
import type { AssistedKind, CreateResult } from "@/lib/assisted/shape";

const str = (v: FormDataEntryValue | null): string => (typeof v === "string" ? v.trim() : "");
const nul = (v: FormDataEntryValue | null): string | null => str(v) || null;
const bool = (v: FormDataEntryValue | null): boolean => str(v) === "on" || str(v) === "true";

export async function createAssistedBusinessAction(form: FormData): Promise<CreateResult> {
  await requireAdmin();
  const name = str(form.get("name"));
  if (!name) return { created: false, reason: "error", message: "Please give the organisation’s name." };
  const address = str(form.get("address"));
  if (!address) return { created: false, reason: "error", message: "Please give an address or place." };
  const result = await createBusiness({
    name, category: str(form.get("category")) || "other", address,
    description: nul(form.get("description")), phone: nul(form.get("phone")),
    email: nul(form.get("email")), website: nul(form.get("website")),
    requestedByName: nul(form.get("requested_by_name")), requestedByEmail: nul(form.get("requested_by_email")),
    requestNote: nul(form.get("request_note")),
    publish: bool(form.get("publish")), confirmDuplicate: bool(form.get("confirm_duplicate")),
  });
  if (result.created) { revalidatePath("/admin/claims"); revalidatePath("/directory"); }
  return result;
}

export async function createAssistedHubAction(form: FormData): Promise<CreateResult> {
  await requireAdmin();
  const name = str(form.get("name"));
  if (!name) return { created: false, reason: "error", message: "Please give the organisation’s name." };
  const result = await createHub({
    name, type: str(form.get("type")) || "other",
    description: nul(form.get("description")), area: nul(form.get("area")),
    contactEmail: nul(form.get("contact_email")), contactPhone: nul(form.get("contact_phone")),
    website: nul(form.get("website")),
    requestedByName: nul(form.get("requested_by_name")), requestedByEmail: nul(form.get("requested_by_email")),
    requestNote: nul(form.get("request_note")),
    publish: bool(form.get("publish")), confirmDuplicate: bool(form.get("confirm_duplicate")),
  });
  if (result.created) { revalidatePath("/admin/hubs"); revalidatePath("/hubs"); }
  return result;
}

export async function setAssistedRequestAction(input: { kind: AssistedKind; id: string; name: string | null; email: string | null; note: string | null }) {
  await requireAdmin();
  const r = await setRequest(input.kind, input.id, input.name, input.email, input.note);
  if (r.ok) { revalidatePath("/admin/hubs"); revalidatePath("/admin/claims"); }
  return r;
}

export async function forgetAssistedContactAction(input: { kind: AssistedKind; id: string }) {
  await requireAdmin();
  const r = await forgetContact(input.kind, input.id);
  if (r.ok) { revalidatePath("/admin/hubs"); revalidatePath("/admin/claims"); }
  return r;
}
