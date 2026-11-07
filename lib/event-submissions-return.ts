/**
 * The account layout sends every signed-out visitor to /sign-in?next=/account, which loses the page they asked for. For the community-event pages
 * only, the proxy sends them to sign-in with THEIR page as the return path (checked by the shared isLocalPath rule). Everything else is unchanged.
 */
import { isLocalPath } from "./redirect";

const PREFIX = "/account/event-submissions";

export function eventSubmissionsSignInRedirect(pathname: string, search = ""): string | null {
  if (pathname !== PREFIX && !pathname.startsWith(PREFIX + "/")) return null;
  const back = pathname + search;
  return isLocalPath(back) ? `/sign-in?next=${encodeURIComponent(back)}` : null;
}
