/**
 * claim-submit.ts — lodging a business claim from the website.
 *
 * The claim is an INSERT into business_claims with status 'pending' (row-level security binds it to the signed-in member; a database trigger caps
 * open claims and records the decider). Nothing here, or anywhere on the client, can approve a claim: that is an administrator's decision.
 *
 * After the claim is saved, the claimant is emailed and the admins are alerted by `notify-business-claim`. That call is fire-and-forget: the claim
 * is already safe, and a notification hiccup must not make it look as if it failed.
 */
export type ClaimInput = { businessId: string; contactName: string; contactEmail: string; contactPhone: string; role: string; evidence: string };
export type ClaimResult = { status: "submitted"; claimId: string | null } | { status: "duplicate" } | { status: "error"; message: string };

export async function submitClaim(sb: any, input: ClaimInput): Promise<ClaimResult> {
  if (!input.contactName.trim() || !input.contactEmail.trim()) return { status: "error", message: "Please give your name and a contact email so we can verify you." };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { status: "error", message: "Please sign in." };
  const { data, error } = await sb.from("business_claims").insert({
    user_id: user.id,
    business_id: input.businessId,
    status: "pending",
    contact_name: input.contactName.trim(),
    contact_email: input.contactEmail.trim(),
    contact_phone: input.contactPhone.trim() || null,
    role: input.role.trim() || null,
    evidence: input.evidence.trim() || null,
  }).select("id").single();
  if (error) {
    // A second claim by the same member on the same business (unique constraint) is already-submitted, not a failure — and is not notified twice.
    if (error.code === "23505" || /duplicate/i.test(error.message ?? "")) return { status: "duplicate" };
    return { status: "error", message: error.message || "Could not submit your claim. Please try again." };
  }
  const claimId: string | null = data?.id ?? null;
  if (claimId) { try { await Promise.resolve(sb.functions.invoke("notify-business-claim", { body: { claim_id: claimId } })).catch(() => {}); } catch { /* never fails the claim */ } }
  return { status: "submitted", claimId };
}
