import { cookies } from "next/headers";
import { getAccount } from "@/lib/auth";
import { parseAudience, AUDIENCE_COOKIE, type Audience } from "@/lib/audience";

/**
 * Reading the audience in a Server Component.
 *
 * Two sources, on purpose. Signed-in people carry it on their profile so it
 * follows them between the app and the site — set it on the phone, the site
 * honours it. Signed-out people get a cookie, because most visitors reading
 * "things to do in Shetland" have never made an account and shouldn't have to.
 * The cookie wins when both exist: it's the more recent deliberate act, and
 * it's what makes the toggle feel immediate.
 *
 * Split from lib/audience.ts because next/headers cannot be pulled into a
 * client component, and the chip is one.
 */
export async function getAudience(): Promise<Audience> {
  const jar = await cookies();
  const fromCookie = parseAudience(jar.get(AUDIENCE_COOKIE)?.value);
  if (fromCookie) return fromCookie;
  try {
    const account = await getAccount();
    return parseAudience((account?.profile as { audience?: string } | null)?.audience) ?? "resident";
  } catch {
    return "resident";
  }
}
