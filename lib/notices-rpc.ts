/**
 * notices-rpc.ts — one way to call a Notices & Alerts RPC and report the outcome, shared by the data readers and the server actions.
 *
 * Nothing is swallowed: a database refusal ("Platform administrators only", "An Essential Alert cannot run for more than 7 days...") comes back as
 * { ok: false, error } with the database's own words, which the UI shows plainly. The CALLER's session is what authorises: pass the signed-in
 * user's server client (never a service-role client). Pure apart from the injected client, so it runs under `node --test`.
 */
export type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
export type RpcResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

export function errorText(e: unknown): string {
  if (!e) return "Something went wrong. Please try again.";
  if (typeof e === "string") return e;
  const m = (e as { message?: unknown }).message;
  return typeof m === "string" && m.trim() ? m.trim() : "Something went wrong. Please try again.";
}

export async function callRpc<T = unknown>(sb: RpcClient, fn: string, args: Record<string, unknown> = {}): Promise<RpcResult<T>> {
  try {
    const { data, error } = await sb.rpc(fn, args);
    if (error) return { ok: false, error: errorText(error) };
    return { ok: true, data: data as T };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Calls the not-yet-deployed notify edge function with the user's own access token; any failure is a plain message, never a thrown error. */
export async function callNotifyAudience(
  opts: { baseUrl: string; accessToken: string | null | undefined; noticeId: string; kind: "essential" | "official" | "member"; fetchImpl?: typeof fetch },
): Promise<RpcResult<{ message: string }>> {
  if (!opts.accessToken) return { ok: false, error: "Please sign in again to send notifications." };
  if (!/^[0-9a-f-]{36}$/i.test(opts.noticeId)) return { ok: false, error: "That notice could not be found." };
  if (opts.kind !== "essential" && opts.kind !== "official" && opts.kind !== "member") return { ok: false, error: "Unknown notification kind." };
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${opts.baseUrl.replace(/\/$/, "")}/functions/v1/notify-notice-audience`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${opts.accessToken}` },
      body: JSON.stringify({ notice_id: opts.noticeId, kind: opts.kind }),
    });
    let body: unknown = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    if (!res.ok) {
      const m = body && typeof body === "object" ? ((body as { error?: unknown; message?: unknown }).error ?? (body as { message?: unknown }).message) : null;
      if (res.status === 404) return { ok: false, error: "Notifications for notices are not switched on yet, so nothing was sent. The notice itself is live." };
      return { ok: false, error: typeof m === "string" && m ? m : `Notifications could not be sent (error ${res.status}). Nothing was sent.` };
    }
    const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const n = (k: string) => (typeof b[k] === "number" ? (b[k] as number) : null);
    // the function reports what each member's outcome was: say exactly that, never "delivered to everyone"
    const msg = typeof b.message === "string" ? b.message
      : b.ok === true && n("sent") !== null
        ? `Notification run finished: ${n("sent")} accepted by the push service, ${n("quiet") ?? 0} not sent because the member was in quiet hours (they are not notified later), ${n("skipped") ?? 0} skipped (not eligible at that moment), ${n("failed") ?? 0} failed.`
        : "Notification request accepted.";
    return { ok: true, data: { message: msg } };
  } catch {
    return { ok: false, error: "Notifications could not be reached just now. Nothing was sent. Please try again in a moment." };
  }
}
