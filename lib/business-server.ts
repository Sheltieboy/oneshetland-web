import { notFound, redirect } from "next/navigation";
import { manageSignInUrl } from "@/lib/redirect";
import { getAccount, type Account } from "@/lib/auth";
import { getManagedBusiness } from "@/lib/business-data.server";
import type { ManagedBusiness } from "@/lib/business-data";

/**
 * Gate a manage route to the business owner. Mirrors requireHubAdmin.
 *
 * Pass `returnPath` (the page being rendered, e.g. `/business/${id}/manage/products/import`) and a signed-out owner
 * comes back to exactly that page after signing in, instead of the manage dashboard. It is optional so every
 * existing call keeps working; see manageReturnPath for what is accepted.
 */
export async function requireBusinessOwner(
  idOrSlug: string,
  opts: { returnPath?: string } = {},
): Promise<{ business: ManagedBusiness; account: Account }> {
  const account = await getAccount();
  if (!account) redirect(manageSignInUrl(idOrSlug, opts.returnPath));
  const business = await getManagedBusiness(idOrSlug);
  if (!business) notFound();
  if (business.owner_id !== account.id) redirect(`/directory/${business.slug || business.id}`);
  return { business, account };
}
