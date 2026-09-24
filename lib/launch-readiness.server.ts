import "server-only";
import { requireAdmin } from "@/lib/admin-data.server";
import { LAUNCH_READINESS } from "@/lib/launch-readiness-data";
import type { ReadinessDataset } from "@/lib/launch-readiness";

/**
 * The only way to read the readiness dataset. It checks admin itself rather
 * than trusting the caller, so no future route can hand the data out by
 * importing this without the guard.
 */
export async function getLaunchReadiness(): Promise<ReadinessDataset> {
  await requireAdmin();
  return LAUNCH_READINESS;
}
