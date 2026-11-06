import { getPublicAccessibility } from "@/lib/accessibility-data";
import type { SubjectType } from "@/lib/accessibility";
import { AccessibilityPanel } from "./AccessibilityPanel";

/** Drop-in for any listing page: two small indexed reads with the anonymous client, so the page stays cacheable and a failure shows nothing. */
export async function AccessibilitySection({ type, id, heading }: { type: SubjectType; id: string; heading?: string }) {
  const profile = await getPublicAccessibility(type, id);
  return <AccessibilityPanel type={type} id={id} profile={profile} heading={heading} />;
}
