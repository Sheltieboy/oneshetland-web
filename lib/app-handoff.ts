/**
 * app-handoff.ts — the website half of the app -> website hand-off (route: /app-handoff). Design and threat model:
 * docs/editions/APP_HANDOFF_SECURITY.md in the delivery repo.
 *
 * No Next imports and no globals: every dependency (edge function client, current-session lookup, session exchange, randomness) is injected so the whole flow runs under plain node.
 *
 *   GET  /app-handoff?code=…   peek only (consumes NOTHING), shows "You will be signed in as j***@…" and a Continue button; sets a one-time CSRF cookie.
 *   POST /app-handoff          CSRF + Origin checks, then the edge function consumes the code exactly once; the server exchanges the one-time token for a normal session
 *                              (cookies set by the same Supabase server client as a normal sign-in) and answers 303 to an allowlisted organiser path.
 *
 * Every failure is the SAME generic page. The code is never logged, never put in a redirect, never echoed except into the confirmation form on the GET.
 */
import { isLocalPath } from "./redirect.ts";

export const CODE_RE = /^[A-Za-z0-9_-]{43}$/;
/** The only places a hand-off may land. Packages, promote, checkout, payments, participation and members are not here and never will be. */
export const ALLOWED_PATH = /^\/organise\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/(?:editions|team|profile)|\/editions\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
export const CSRF_COOKIE = "app_handoff_csrf";
export const CSRF_MAX_AGE_SECONDS = 300;

export const isAllowedPath = (p: unknown): p is string => typeof p === "string" && p.length <= 200 && isLocalPath(p) && ALLOWED_PATH.test(p);

export function securityHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

const htmlHeaders = (nonce: string) => ({
  ...securityHeaders(),
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
});

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length === 0 || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "another account";
  const at = email.lastIndexOf("@");
  return `${email.slice(0, 1)}***@${email.slice(at + 1)}`;
}

export function clientIp(h: { get(name: string): string | null }): string {
  const v = h.get("x-real-ip") || (h.get("x-forwarded-for") ?? "").split(",")[0] || "";
  const ip = v.trim();
  return ip && ip.length <= 64 ? ip : "unknown";
}

/** A browser form POST carries Origin; it must be this site. (The CSRF cookie is the real defence; this refuses cross-site posts early and cheaply.) */
export function originOk(h: { get(name: string): string | null }, expectedOrigin: string): boolean {
  const site = h.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = h.get("origin");
  return !!origin && origin === expectedOrigin;
}

export function cookieValue(cookieHeader: string | null | undefined, name: string): string {
  for (const part of (cookieHeader ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}

const PAGE_CSS = "body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;padding:24px 16px;background:#f7f6f2;color:#1b1b1b}main{max-width:440px;margin:8vh auto 0;background:#fff;border:1px solid #e2e0d8;border-radius:12px;padding:24px}h1{font-size:1.25rem;margin:0 0 12px}p{line-height:1.5;margin:0 0 12px}button,a.btn{display:block;width:100%;box-sizing:border-box;text-align:center;font:inherit;font-weight:600;padding:14px 16px;border-radius:10px;border:0;background:#0b3d5c;color:#fff;text-decoration:none;cursor:pointer}a.sec{display:block;text-align:center;margin-top:12px;color:#0b3d5c}.note{font-size:.875rem;color:#555}";
const shell = (title: string, body: string, nonce: string, script = "") =>
  `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)}</title><style>${PAGE_CSS}</style></head><body><main>${body}</main>${script ? `<script nonce="${nonce}">${script}</script>` : ""}</body></html>`;

/** The one page for every failure: nothing about why. */
export function renderErrorPage(nonce: string): string {
  return shell("Link not available", `<h1>This link is no longer available</h1><p>It may have expired or already been used. Go back to the app and try again, or sign in on the website as usual.</p><a class="btn" href="/sign-in">Sign in on the website</a>`, nonce);
}

export function renderConfirmPage(o: { code: string; emailMasked: string; currentMasked: string | null; csrf: string; nonce: string }): string {
  const switching = o.currentMasked ? `<p class="note">This browser is currently signed in to the website as ${escapeHtml(o.currentMasked)}. Continuing will switch it to the account above.</p>` : "";
  // The address bar is cleaned as soon as the page runs, so a refresh, a screenshot or a shared tab no longer carries the code.
  const script = `try{history.replaceState(null,"","/app-handoff")}catch(e){}`;
  return shell("Continue on the website", `<h1>Continue on the website</h1><p>You will be signed in as <strong>${escapeHtml(o.emailMasked)}</strong>.</p>${switching}<p class="note">Only continue if you just chose this on your own phone.</p><form method="post" action="/app-handoff"><input type="hidden" name="code" value="${escapeHtml(o.code)}"><input type="hidden" name="csrf" value="${escapeHtml(o.csrf)}"><button type="submit">Continue</button></form><a class="sec" href="/sign-in">Not you? Sign in another way</a>`, o.nonce, script);
}

// ── edge client ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface EdgeConfig { url: string; anonKey: string; secret: string; fetch?: typeof fetch; timeoutMs?: number }
export type PeekResult = { valid: true; email_masked: string } | { valid: false };
export type RedeemResult = { ok: true; token_hash: string; path: string; user_id: string } | { ok: false };

/** Server-to-server only. Never throws; any problem is a refusal. The secret and the code travel in headers/body, never in a URL. */
export async function callEdge(cfg: EdgeConfig, action: "peek" | "redeem", code: string, ip: string): Promise<PeekResult | RedeemResult> {
  const fail = action === "peek" ? ({ valid: false } as const) : ({ ok: false } as const);
  if (!cfg.url || !cfg.anonKey || !cfg.secret) return fail;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), cfg.timeoutMs ?? 8000);
    const res = await (cfg.fetch ?? fetch)(`${cfg.url.replace(/\/+$/, "")}/functions/v1/editions-web-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, "x-handoff-secret": cfg.secret },
      body: JSON.stringify({ action, code, ip }),
      cache: "no-store",
      redirect: "error",
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return fail;
    const j = await res.json();
    if (action === "peek") return j?.valid === true && typeof j.email_masked === "string" ? { valid: true, email_masked: j.email_masked } : fail;
    return j?.ok === true && typeof j.token_hash === "string" && j.token_hash.length > 0 && isAllowedPath(j.path) && typeof j.user_id === "string" ? { ok: true, token_hash: j.token_hash, path: j.path, user_id: j.user_id } : fail;
  } catch {
    return fail;
  }
}

// ── the two handlers ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Deps {
  origin: string;                                                  // this site's origin, e.g. https://oneshetland.com
  secureCookies: boolean;
  edge: (action: "peek" | "redeem", code: string, ip: string) => Promise<PeekResult | RedeemResult>;
  currentEmail: () => Promise<string | null>;                      // who the browser is signed in as now (or null)
  /** Exchange the one-time token for a normal web session (cookies set as for a normal sign-in). Returns the signed-in user id, or null. */
  exchange: (tokenHash: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  nonce?: () => string;
  csrf?: () => string;
}
export interface Cookie { name: string; value: string; options: { httpOnly: boolean; secure: boolean; sameSite: "strict"; path: string; maxAge: number } }
export interface Out { status: number; headers: Record<string, string>; body: string; cookies: Cookie[] }

const csrfCookie = (d: Deps, value: string, maxAge: number): Cookie => ({ name: CSRF_COOKIE, value, options: { httpOnly: true, secure: d.secureCookies, sameSite: "strict", path: "/app-handoff", maxAge } });
const errorOut = (d: Deps, status = 400): Out => { const n = (d.nonce ?? randomToken)(); return { status, headers: htmlHeaders(n), body: renderErrorPage(n), cookies: [csrfCookie(d, "", 0)] }; };

export async function handleGet(h: { get(name: string): string | null }, code: string | null, d: Deps): Promise<Out> {
  if (!code || !CODE_RE.test(code)) return errorOut(d);
  const peek = await d.edge("peek", code, clientIp(h));
  if (!("valid" in peek) || !peek.valid) return errorOut(d);
  const current = await d.currentEmail().catch(() => null);
  const nonce = (d.nonce ?? randomToken)(), csrf = (d.csrf ?? (() => randomToken(32)))();
  return { status: 200, headers: htmlHeaders(nonce), body: renderConfirmPage({ code, emailMasked: peek.email_masked, currentMasked: current ? maskEmail(current) : null, csrf, nonce }), cookies: [csrfCookie(d, csrf, CSRF_MAX_AGE_SECONDS)] };
}

export async function handlePost(h: { get(name: string): string | null }, form: { code?: unknown; csrf?: unknown }, d: Deps): Promise<Out> {
  const cookieCsrf = cookieValue(h.get("cookie"), CSRF_COOKIE);
  if (!originOk(h, d.origin)) return errorOut(d, 403);
  if (typeof form.csrf !== "string" || !timingSafeEqual(form.csrf, cookieCsrf)) return errorOut(d, 403);        // no cookie from the GET: a cross-site or scripted post
  if (typeof form.code !== "string" || !CODE_RE.test(form.code)) return errorOut(d);
  const r = await d.edge("redeem", form.code, clientIp(h));
  if (!("ok" in r) || !r.ok || !isAllowedPath(r.path)) return errorOut(d);
  const uid = await d.exchange(r.token_hash).catch(() => null);
  if (uid !== r.user_id) {
    if (uid) await d.signOut().catch(() => undefined);                                                           // a session for anybody else is never kept
    return errorOut(d);
  }
  return { status: 303, headers: { ...securityHeaders(), Location: new URL(r.path, d.origin).toString() }, body: "", cookies: [csrfCookie(d, "", 0)] };
}
