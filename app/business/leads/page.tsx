import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * /business/leads — a shortcut that lands on the right business's leads page.
 *
 * The real page lives at /business/[id]/manage/leads, with everything else an
 * owner manages. This exists because "job leads" is the kind of thing somebody
 * types or bookmarks directly, and because emails and notifications need one
 * stable URL that works without knowing the business id.
 */

export const dynamic = "force-dynamic";

export default async function LeadsShortcut() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/business/leads");

  const sb = await createClient();
  const { data } = await sb
    .from("local_businesses")
    .select("id")
    .eq("owner_id", account.id)
    .eq("is_active", true)
    .limit(1);

  const id = (data ?? [])[0]?.id as string | undefined;
  redirect(id ? `/business/${id}/manage/leads` : "/business");
}
