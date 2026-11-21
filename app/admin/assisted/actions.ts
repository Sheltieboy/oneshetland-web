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
import { createBusiness, createHub, forgetContact, setRequest, updateBusiness, updateHub } from "@/lib/assisted/client";
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

/** Correct an unclaimed record. NULL/absent means "leave that field alone", which the database honours. */
export async function editAssistedAction(form: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const kind = str(form.get("kind")) === "hub" ? "hub" : "business";
  const id = str(form.get("id"));
  if (!id) return { ok: false, error: "Which record?" };
  const publish = form.get("publish") === null ? undefined : bool(form.get("publish"));
  const r = kind === "hub"
    ? await updateHub(id, {
        name: str(form.get("name")) || undefined, type: str(form.get("type")) || undefined,
        description: nul(form.get("description")), area: nul(form.get("area")),
        contactEmail: nul(form.get("contact_email")), contactPhone: nul(form.get("contact_phone")),
        website: nul(form.get("website")), publish,
      })
    : await updateBusiness(id, {
        name: str(form.get("name")) || undefined, category: str(form.get("category")) || undefined,
        address: str(form.get("address")) || undefined, description: nul(form.get("description")),
        phone: nul(form.get("phone")), email: nul(form.get("email")), website: nul(form.get("website")), publish,
      });
  if (r.ok) {
    revalidatePath("/admin/hubs"); revalidatePath("/admin/claims");
    revalidatePath(kind === "hub" ? "/hubs" : "/directory");
  }
  return r;
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
