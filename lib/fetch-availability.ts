/**
 * fetch-availability.ts — whether this visitor may see Fetch, as decided by the DATABASE.
 *
 * Fetch is paused while Fetch v2 is built (oneshetland-delivers docs/FETCH_V2_IMPLEMENTATION.md, Step 0a/0b). The answer comes from
 * the `fetch_v2_enabled()` RPC (off / admins / testers / everyone, managed by an administrator); nothing here decides it.
 *
 * It fails closed. An error — including the RPC not existing yet on a database that has not had the flag migration — or any answer
 * other than a literal `true`, means Fetch is unavailable. So the site hides Fetch even before the backend flag is deployed.
 *
 * Pure: imported by proxy.ts (which rewrites every /fetch route to the coming-soon page when this says no) and by server code.
 */

/** Shop → Fetch delivery (a business's order collected by a Fetch driver) is P2 in Fetch v2 and stays unoffered until it is rewired
 *  onto the v2 lifecycle: the basket never offers it and sellers cannot switch it on, whatever a business's saved setting says. */
export const SHOP_FETCH_DELIVERY_OFFERED = false;

/** Where every /fetch route is rewritten to while Fetch is unavailable to the visitor. */
export const FETCH_UNAVAILABLE_PATH = "/fetch-coming-soon";

/** The Fetch routes the gate covers: /fetch itself and everything below it. */
export function isFetchPath(pathname: string): boolean {
  return pathname === "/fetch" || pathname.startsWith("/fetch/");
}

/** Reads an RPC result `{ data, error }`; only a literal `true` with no error means enabled. */
export function fetchEnabledFrom(result: { data?: unknown; error?: unknown } | null | undefined): boolean {
  return !!result && !result.error && result.data === true;
}

type RpcClient = { rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }> };

/** Asks the database. Never throws; any failure is "not available". */
export async function fetchEnabledFor(sb: RpcClient): Promise<boolean> {
  try {
    return fetchEnabledFrom(await sb.rpc("fetch_v2_enabled"));
  } catch {
    return false;
  }
}
