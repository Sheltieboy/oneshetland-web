import { notFound, redirect } from "next/navigation";
import { resolveTesterContext } from "@/lib/launch-testing/data.server";

/**
 * The one door into the tester pages. Signed out → the normal sign-in; an administrator who is not a tester → the admin dashboard; anyone
 * else who is not an enabled tester gets the ordinary "not found" page, which reveals nothing about what exists.
 */
export async function requireTester(next: string) {
  const ctx = await resolveTesterContext();
  if (ctx.access === "sign_in") redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (ctx.access === "admin_only") redirect("/admin/launch-testing");
  if (ctx.access !== "tester") notFound();
  return ctx;
}
