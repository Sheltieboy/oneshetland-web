import { createClient as createCookieClient } from "@/lib/supabase/server";
import { createClient as createTokenClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

/**
 * ai-guard.server.ts — the one gate in front of everything that spends the
 * Anthropic key.
 *
 * WHY THIS EXISTS
 *
 * Eight billable AI routes live under /api/ai. Six of them had no
 * authentication at all: anyone on the internet could POST to them and spend
 * the OneShetland Anthropic key. The two that were gated had no usage ceiling,
 * so one signed-in account could call them in a loop for ever. None of the
 * eight bounded how much text could be sent.
 *
 * Eight hand-written security implementations would drift. This is one, and a
 * ninth route that forgets to call it is caught by a test that reads the
 * directory.
 *
 * THE ORDER IS THE POINT
 *
 *   body size  →  authentication  →  field size  →  quota  →  Anthropic
 *
 * Nothing below a failed step runs, and the Anthropic client is never
 * constructed until the whole gate has passed. A route that instantiates the
 * SDK first and checks afterwards has already lost, because the expensive part
 * is the call, not the object.
 *
 * TWO KINDS OF CALLER, BOTH AUTHENTICATED
 *
 * The website posts from the browser with a Supabase session cookie. The mobile
 * app posts cross-origin and has no cookies at all — it carries a Bearer token.
 * A cookie-only check would have looked correct and quietly broken every AI
 * feature in the app, so both are accepted and both are verified by Supabase.
 * Neither is trusted from the body.
 *
 * NO SERVICE-ROLE KEY
 *
 * This website has never held the service-role key and still does not. The
 * quota RPC is SECURITY DEFINER, granted to `authenticated`, and derives the
 * user from auth.uid() — so it is called with the CALLER's own session and
 * there is no identity to forge, because there is no identity to pass.
 */

/** Canonical route names — also the quota keys. Keep in step with the directory. */
export type AiRoute =
  | "draft-product"
  | "draft-article"
  | "draft-social"
  | "parse-brief"
  | "parse-event"
  | "parse-job"
  | "parse-shift"
  | "plan-day";

export type GuardOptions = {
  route: AiRoute;
  /** Hard ceiling on the decoded request body. */
  maxBodyBytes: number;
  /** Hard ceiling on any single string field in the body. */
  maxFieldChars: number;
};

export type GuardResult =
  | { ok: true; user: User; supabase: SupabaseClient; body: Record<string, unknown> }
  | { ok: false; response: Response };

const json = (body: unknown, status: number, headers?: HeadersInit) =>
  Response.json(body, { status, headers });

/**
 * Resolve the caller from a Bearer token if there is one, otherwise from the
 * session cookie. The returned client carries that identity, so the quota RPC
 * it later calls is attributed to the right person by the database itself.
 */
async function resolveCaller(
  request: Request,
): Promise<{ user: User; supabase: SupabaseClient } | null> {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  if (bearer) {
    // Verified by Supabase — a forged or expired token yields no user.
    const supabase = createTokenClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false } },
    );
    const { data } = await supabase.auth.getUser();
    if (data.user) return { user: data.user, supabase };
    // A bad Bearer token is a refusal, not an invitation to try cookies —
    // otherwise a caller could probe with a junk token and fall through.
    return null;
  }

  const supabase = (await createCookieClient()) as unknown as SupabaseClient;
  const { data } = await supabase.auth.getUser();
  return data.user ? { user: data.user, supabase } : null;
}

/** Every string anywhere in the parsed body, so nested content cannot dodge the cap. */
function longestString(value: unknown, depth = 0): number {
  if (depth > 8) return 0;
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) return value.reduce<number>((m, v) => Math.max(m, longestString(v, depth + 1)), 0);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .reduce<number>((m, v) => Math.max(m, longestString(v, depth + 1)), 0);
  }
  return 0;
}

export async function guardAi(request: Request, opts: GuardOptions): Promise<GuardResult> {
  // ── 1. Size, before anything is parsed or authenticated ─────────────────
  //
  // Content-Length is a hint from the caller and is not trusted on its own —
  // it is only a cheap early exit. The decoded body is measured below, which is
  // the number that actually matters.
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > opts.maxBodyBytes) {
    return { ok: false, response: json({ error: "That's too much text for Peerie Bot to read." }, 413) };
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, response: json({ error: "Bad request." }, 400) };
  }
  if (new TextEncoder().encode(raw).length > opts.maxBodyBytes) {
    return { ok: false, response: json({ error: "That's too much text for Peerie Bot to read." }, 413) };
  }

  // ── 2. Who is this? ─────────────────────────────────────────────────────
  const caller = await resolveCaller(request);
  if (!caller) {
    return { ok: false, response: json({ error: "Sign in to use Peerie Bot." }, 401) };
  }

  // ── 3. Shape and field sizes ────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, response: json({ error: "Bad request." }, 400) };
  }
  if (longestString(body) > opts.maxFieldChars) {
    return { ok: false, response: json({ error: "That's too much text for Peerie Bot to read." }, 413) };
  }

  // ── 4. Quota ────────────────────────────────────────────────────────────
  //
  // Called with the caller's own session, so the database attributes it from
  // auth.uid(). Nothing here says who the user is.
  let claim: {
    allowed: boolean; reason: string; retry_after_secs: number;
  } | null = null;
  try {
    const { data, error } = await caller.supabase
      .rpc("claim_ai_request", { p_route: opts.route })
      .maybeSingle<{ allowed: boolean; reason: string; retry_after_secs: number }>();
    if (error) throw error;
    claim = data;
  } catch (err) {
    // FAIL CLOSED. A broken cost control is not permission to spend without
    // one. This is deliberately the opposite of "limiter unavailable — carry on".
    console.error(`[ai-guard:${opts.route}] quota check failed:`, err);
    return { ok: false, response: json({ error: "Peerie Bot is unavailable right now — try again shortly." }, 503) };
  }
  if (!claim || !claim.allowed) {
    const retry = Math.max(1, claim?.retry_after_secs ?? 60);
    return {
      ok: false,
      response: json(
        { error: "You've used Peerie Bot a lot in a short time. Give it a few minutes and try again." },
        429,
        { "Retry-After": String(retry) },
      ),
    };
  }

  return { ok: true, user: caller.user, supabase: caller.supabase, body };
}

/**
 * One safe failure shape for provider errors.
 *
 * The detail goes to the server log, where it is useful. The caller gets a
 * plain sentence — never a provider message, request id, stack or configuration
 * detail, any of which can describe our setup to someone probing it.
 */
export function aiProviderFailure(route: AiRoute, err: unknown): Response {
  console.error(`[ai:${route}] provider call failed:`, err);
  return json({ error: "Peerie Bot had a moment — try again." }, 502);
}
