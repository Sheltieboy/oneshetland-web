import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { EditionsTabs } from "@/components/admin/EditionsAdminParts";
import { EditionsLaunchAdmin } from "@/components/admin/EditionsLaunchAdmin";
import { SWITCH_KEYS } from "./switches";
import { reviewCounts } from "../queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editions launch" };

/**
 * The launch controls: whether Editions is visible to the public, and whether new organisers may start one. Two separate switches, because they
 * used to be the same one — opening Editions to visitors also opened organiser registration to the whole membership on the same day.
 *
 * Both are read straight from admin_config here and decided by the database everywhere that matters; this page only sets them, through
 * admin_set_editions_switch, which audits every change.
 */
export default async function EditionsLaunchPage() {
  await requireAdmin();
  const sb = await createClient();
  const { data } = await sb.from("admin_config").select("key, value").in("key", [...SWITCH_KEYS]);
  const config = Object.fromEntries(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  return (
    <div className="space-y-6">
      <EditionsTabs active="launch" waiting={(await reviewCounts()).waiting} />
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Launch</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Who can see Editions, and who can start one. Both are off until someone switches them on here, and each change is recorded in the audit log.
        </p>
      </div>
      <EditionsLaunchAdmin config={config} />
    </div>
  );
}
