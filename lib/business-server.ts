import { notFound, redirect } from "next/navigation";
import { getAccount, type Account } from "@/lib/auth";
import { getManagedBusiness } from "@/lib/business-data.server";
import type { ManagedBusiness } from "@/lib/business-data";

/** Gate a manage route to the business owner. Mirrors requireHubAdmin. */
export async function requireBusinessOwner(idOrSlug: string): Promise<{ business: ManagedBusiness; account: Account }> {
  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=/business/${idOrSlug}/manage`);
  const business = await getManagedBusiness(idOrSlug);
  if (!business) notFound();
  if (business.owner_id !== account.id) redirect(`/directory/${business.slug || business.id}`);
  return { business, account };
}
