// Test-only stand-ins for next/link, next/image and next/navigation (used by loader-jsx.mjs).
import { createElement as h } from "react";
export function Link({ href, children, prefetch, scroll, replace, ...r }) { return h("a", { href: typeof href === "string" ? href : String(href?.pathname ?? ""), ...r }, children); }
export const usePathname = () => globalThis.__PATH__ ?? "/account";
export const useRouter = () => ({ push() {}, replace() {}, refresh() {} });
export const useSearchParams = () => new URLSearchParams();
export const redirect = () => { throw new Error("redirect"); };
export const notFound = () => { throw new Error("notFound"); };
export default Link;
