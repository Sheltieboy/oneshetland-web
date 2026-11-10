// Test-only stand-ins for next/link, next/image and next/navigation (used by loader-jsx.mjs).
import { createElement as h } from "react";
export function Link({ href, children, prefetch, scroll, replace, ...r }) { return h("a", { href: typeof href === "string" ? href : String(href?.pathname ?? ""), ...r }, children); }
export const usePathname = () => globalThis.__PATH__ ?? "/account";
export const useSelectedLayoutSegment = () => { const m = /^\/editions\/[^/]+\/([^/]+)/.exec(globalThis.__PATH__ ?? ""); return m ? m[1] : null; };
export const useRouter = () => ({ push() {}, replace() {}, refresh() {} });
export const useSearchParams = () => new URLSearchParams();
export const redirect = () => { throw new Error("redirect"); };
export const permanentRedirect = (to) => { throw new Error(`redirect:${to}`); };
export const notFound = () => { throw new Error("notFound"); };
export default Link;
