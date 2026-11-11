/**
 * app-handoff.ts — the website half of the app -> website hand-off (route: /app-handoff). Design and threat model:
 * docs/editions/APP_HANDOFF_SECURITY.md in the delivery repo.
 *
 * No Next imports and no globals: every dependency (edge function client, current-session lookup, session exchange, randomness) is injected so the whole flow runs under plain node.
 *
 * The code lives in the URL FRAGMENT (/app-handoff#c=…), which browsers never send to any server. So:
 *   GET  /app-handoff    a static page, no parameters, consumes nothing. Its script reads the fragment, removes it from the address bar, and POSTs it in a body.
 *   POST step=peek       (script) checks the code WITHOUT consuming it, returns the confirmation form: the FULL account address, a "Not you? Close this page" first action,
 *                        and a box for the 4-digit check number the app showed. Refuses (plain message) if this browser is signed in as a different user. Sets the CSRF cookie.
 *   POST step=redeem     (form) CSRF + Origin checks, the same different-user refusal, then the edge function checks the number (three wrong numbers burn the code), consumes the code
 *                        exactly once, and the server exchanges the one-time token for a normal session (cookies set by the same Supabase server client as a normal sign-in).
 *                        303 to an allowlisted organiser path. The outcome is recorded (edge "complete") only after the session exists.
 *
 * Every failure is the SAME generic page. The code and number are never logged and never put in a URL or a redirect.
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
  "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
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

/**
 * The client address, ONLY from the platform-verified header (Vercel sets x-vercel-forwarded-for itself and overwrites anything the client sent; no other web route in this site reads a
 * forwarded-address header, so there is nothing older to reuse). Anything else, or nothing, is null: the edge function then throttles by code instead of pooling strangers into a shared
 * bucket. Behind carrier-grade NAT many people share one address, so the per-address limit is deliberately generous (30 per 10 minutes) and is a cost brake, not a defence.
 */
export function clientIp(h: { get(name: string): string | null }): string | null {
  const ip = (h.get("x-vercel-forwarded-for") ?? "").split(",")[0].trim();
  return ip && ip.length <= 64 && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null;
}

/** A browser form POST carries Origin; it must be this site. (The CSRF cookie is the real defence; this refuses cross-site posts early and cheaply.) */
export function originCheck(h: { get(name: string): string | null }, expectedOrigin: string): "ok" | "null" | "bad" {
  const origin = h.get("origin");
  if (origin === "null") return "null";                                  // sandboxed or privacy-stripped context: cannot be told apart from an attacker's
  const site = h.get("sec-fetch-site");
  if (site && site !== "same-origin") return "bad";
  return origin && origin === expectedOrigin ? "ok" : "bad";
}

export function cookieValue(cookieHeader: string | null | undefined, name: string): string {
  for (const part of (cookieHeader ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}

const PAGE_CSS = "body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;padding:24px 16px;background:#f7f6f2;color:#1b1b1b}main{max-width:440px;margin:8vh auto 0;background:#fff;border:1px solid #e2e0d8;border-radius:12px;padding:24px}h1{font-size:1.25rem;margin:0 0 12px}p{line-height:1.5;margin:0 0 12px}button,a.btn{display:block;width:100%;box-sizing:border-box;text-align:center;font:inherit;font-weight:600;padding:14px 16px;border-radius:10px;border:0;background:#0b3d5c;color:#fff;text-decoration:none;cursor:pointer}a.sec{display:block;text-align:center;margin:0 0 16px;padding:12px;border:1px solid #0b3d5c;border-radius:10px;color:#0b3d5c;font-weight:600;text-decoration:none}input[name=number]{font:inherit;font-size:1.5rem;letter-spacing:.4em;text-align:center;width:100%;box-sizing:border-box;padding:12px;margin:0 0 12px;border:1px solid #888;border-radius:10px}.who{font-size:1.1rem;font-weight:700;word-break:break-all}.note{font-size:.875rem;color:#555}.err{color:#8a1c1c;font-weight:600}";
const shell = (title: string, body: string, nonce: string, script = "") =>
  `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)}</title><style>${PAGE_CSS}</style></head><body><main id="root">${body}</main>${script ? `<script nonce="${nonce}">${script}</script>` : ""}</body></html>`;

const ERROR_BODY = (msg?: string) => `<h1>This link is no longer available</h1><p>${escapeHtml(msg ?? "It may have expired or already been used. Go back to the app and try again, or sign in on the website as usual.")}</p><a class="btn" href="/sign-in">Sign in on the website</a>`;
/** The one page for every failure: nothing about why (except the few plain messages the person can act on). */
export function renderErrorPage(nonce: string, msg?: string): string {
  return shell("Link not available", ERROR_BODY(msg), nonce);
}

/** The confirmation form (also used, escaped, as the body the script inserts). The code sits in a hidden field of a POST form, never in a URL. */
export function renderConfirmBody(o: { code: string; email: string; csrf: string; message?: string }): string {
  return `<a class="sec" id="notyou" href="about:blank">Not you? Close this page</a><h1>Continue on the website</h1><p>You will be signed in as</p><p class="who">${escapeHtml(o.email)}</p>${o.message ? `<p class="err">${escapeHtml(o.message)}</p>` : ""}<form method="post" action="/app-handoff"><input type="hidden" name="step" value="redeem"><input type="hidden" name="code" value="${escapeHtml(o.code)}"><input type="hidden" name="csrf" value="${escapeHtml(o.csrf)}"><p class="note"><label for="n">Enter the check number shown in the app</label></p><input id="n" name="number" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required><button type="submit">Continue</button></form><p class="note">Only continue if this is your account and you just chose this on your own phone.</p>`;
}
export function renderBlockedBody(o: { target: string; current: string }): string {
  return `<h1>Sign out first</h1><p>This browser is already signed in to the website as <strong>${escapeHtml(o.current)}</strong>, which is a different account from <strong>${escapeHtml(o.target)}</strong>.</p><p>Nothing has been changed. Sign out of the website, then open the link from the app again.</p><a class="btn" href="/">Go to the website</a>`;
}

/** The static page: no data of its own. The script takes the code from the fragment, removes it from the address bar at once, and asks the server about it with a POST body. */
const PAGE_SCRIPT = `(function(){var root=document.getElementById("root");var m=/^#c=([A-Za-z0-9_-]{43})$/.exec(location.hash||"");try{history.replaceState(null,"","/app-handoff")}catch(e){}function fail(){root.innerHTML=${JSON.stringify(ERROR_BODY()).replace(/<\//g, "<\\/")}}document.addEventListener("click",function(e){var t=e.target;if(t&&t.id==="notyou"){e.preventDefault();try{window.close()}catch(x){}location.replace("about:blank")}});if(!m){fail();return}fetch("/app-handoff",{method:"POST",credentials:"same-origin",cache:"no-store",referrerPolicy:"no-referrer",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"step=peek&code="+encodeURIComponent(m[1])}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.valid&&typeof j.html==="string"){root.innerHTML=j.html;var n=document.getElementById("n");if(n)n.focus()}else fail()}).catch(fail)})();`;

export function renderLandingPage(nonce: string): string {
  return shell("Continue on the website", `<h1>One moment</h1><p>Checking your link.</p><noscript><p>This page needs JavaScript. Go back to the app, or sign in on the website as usual.</p></noscript>`, nonce, PAGE_SCRIPT);
}

// ── edge client ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface EdgeConfig { url: string; anonKey: string; secret: string; fetch?: typeof fetch; timeoutMs?: number }
export type PeekResult = { valid: true; user_id: string; email: string } | { valid: false };
export type RedeemResult = { ok: true; token_hash: string; path: string; user_id: string } | { ok: false; reason?: string; left?: number };
export type EdgeCall =
  | { action: "peek"; code: string; ip: string | null }
  | { action: "redeem"; code: string; number: string; ip: string | null }
  | { action: "complete"; code: string; ok: boolean; reason?: string };

/** Server-to-server only. Never throws; any problem is a refusal. The secret and the code travel in headers/body, never in a URL. */
export async function callEdge(cfg: EdgeConfig, call: EdgeCall): Promise<PeekResult | RedeemResult | { ok: boolean }> {
  const fail = call.action === "peek" ? ({ valid: false } as const) : ({ ok: false } as const);
  if (!cfg.url || !cfg.anonKey || !cfg.secret) return fail;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), cfg.timeoutMs ?? 8000);
    const res = await (cfg.fetch ?? fetch)(`${cfg.url.replace(/\/+$/, "")}/functions/v1/editions-web-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, "x-handoff-secret": cfg.secret },
      body: JSON.stringify(call),
      cache: "no-store",
      redirect: "error",
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return fail;
    const j = await res.json();
    if (call.action === "peek") return j?.valid === true && typeof j.user_id === "string" && typeof j.email === "string" && j.email.includes("@") ? { valid: true, user_id: j.user_id, email: j.email } : fail;
    if (call.action === "complete") return { ok: j?.ok === true };
    if (j?.ok === true) return typeof j.token_hash === "string" && j.token_hash.length > 0 && isAllowedPath(j.path) && typeof j.user_id === "string" ? { ok: true, token_hash: j.token_hash, path: j.path, user_id: j.user_id } : fail;
    return { ok: false, reason: typeof j?.reason === "string" ? j.reason : undefined, left: typeof j?.left === "number" ? j.left : undefined };
  } catch {
    return fail;
  }
}

// ── the handlers ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Deps {
  origin: string;                                                  // this site's origin, e.g. https://oneshetland.com
  secureCookies: boolean;
  edge: (call: EdgeCall) => Promise<PeekResult | RedeemResult | { ok: boolean }>;
  currentUser: () => Promise<{ id: string; email: string } | null>;   // who this browser is signed in as now (or null)
  /** Exchange the one-time token for a normal web session (cookies set as for a normal sign-in). Returns the signed-in user id, or null. */
  exchange: (tokenHash: string) => Promise<string | null>;
  /** Ends ONLY this browser's session (scope "local"); never every device the person has. */
  signOut: () => Promise<void>;
  nonce?: () => string;
  csrf?: () => string;
}
export interface Cookie { name: string; value: string; options: { httpOnly: boolean; secure: boolean; sameSite: "strict"; path: string; maxAge: number } }
export interface Out { status: number; headers: Record<string, string>; body: string; cookies: Cookie[] }
type Headers = { get(name: string): string | null };

const csrfCookie = (d: Deps, value: string, maxAge: number): Cookie => ({ name: CSRF_COOKIE, value, options: { httpOnly: true, secure: d.secureCookies, sameSite: "strict", path: "/app-handoff", maxAge } });
const nonceOf = (d: Deps) => (d.nonce ?? randomToken)();
const errorOut = (d: Deps, status = 400, msg?: string): Out => { const n = nonceOf(d); return { status, headers: htmlHeaders(n), body: renderErrorPage(n, msg), cookies: [csrfCookie(d, "", 0)] }; };
const jsonHeaders = () => ({ ...securityHeaders(), "Content-Type": "application/json; charset=utf-8" });
const ORIGIN_MSG = "This page was opened in a way we cannot check. Go back to the app and try again.";

/** GET: static, no parameters, no lookups, nothing consumed. */
export function handleGet(d: Deps): Out {
  const n = nonceOf(d);
  return { status: 200, headers: htmlHeaders(n), body: renderLandingPage(n), cookies: [] };
}

/** Whether this browser is signed in as somebody OTHER than the code's user (then we refuse rather than switch accounts silently). */
async function otherAccount(d: Deps, userId: string): Promise<{ id: string; email: string } | null> {
  const cur = await d.currentUser().catch(() => null);
  return cur && cur.id !== userId ? cur : null;
}

/** POST step=peek (called by the page script). JSON: { valid, html }. Consumes nothing. */
export async function handlePeek(h: Headers, form: { code?: unknown }, d: Deps): Promise<Out> {
  const bad = (status = 200): Out => ({ status, headers: jsonHeaders(), body: JSON.stringify({ valid: false }), cookies: [] });
  if (originCheck(h, d.origin) !== "ok") return bad(403);
  if (typeof form.code !== "string" || !CODE_RE.test(form.code)) return bad();
  const p = await d.edge({ action: "peek", code: form.code, ip: clientIp(h) });
  if (!("valid" in p) || !p.valid) return bad();
  const other = await otherAccount(d, p.user_id);
  if (other) return { status: 200, headers: jsonHeaders(), body: JSON.stringify({ valid: true, html: renderBlockedBody({ target: p.email, current: other.email }) }), cookies: [] };
  const csrf = (d.csrf ?? (() => randomToken(32)))();
  return { status: 200, headers: jsonHeaders(), body: JSON.stringify({ valid: true, html: renderConfirmBody({ code: form.code, email: p.email, csrf }) }), cookies: [csrfCookie(d, csrf, CSRF_MAX_AGE_SECONDS)] };
}

/** POST step=redeem (the confirmation form). */
export async function handleRedeem(h: Headers, form: { code?: unknown; csrf?: unknown; number?: unknown }, d: Deps): Promise<Out> {
  const oc = originCheck(h, d.origin);
  if (oc === "null") return errorOut(d, 403, ORIGIN_MSG);
  if (oc !== "ok") return errorOut(d, 403);
  const cookieCsrf = cookieValue(h.get("cookie"), CSRF_COOKIE);
  if (typeof form.csrf !== "string" || !timingSafeEqual(form.csrf, cookieCsrf)) return errorOut(d, 403);        // no cookie from the page's own peek: a scripted or cross-site post
  if (typeof form.code !== "string" || !CODE_RE.test(form.code)) return errorOut(d);
  const code = form.code;
  const ip = clientIp(h);

  const p = await d.edge({ action: "peek", code, ip });
  if (!("valid" in p) || !p.valid) return errorOut(d);
  const other = await otherAccount(d, p.user_id);
  if (other) { const n = nonceOf(d); return { status: 200, headers: htmlHeaders(n), body: shell("Sign out first", renderBlockedBody({ target: p.email, current: other.email }), n), cookies: [csrfCookie(d, "", 0)] }; }

  const retry = (message: string): Out => {
    const n = nonceOf(d), csrf = (d.csrf ?? (() => randomToken(32)))();
    return { status: 200, headers: htmlHeaders(n), body: shell("Continue on the website", renderConfirmBody({ code, email: p.email, csrf, message }), n), cookies: [csrfCookie(d, csrf, CSRF_MAX_AGE_SECONDS)] };
  };
  if (typeof form.number !== "string" || !/^[0-9]{4}$/.test(form.number)) return retry("Enter the 4 digits shown in the app.");

  const r = (await d.edge({ action: "redeem", code, number: form.number, ip })) as RedeemResult;
  if (typeof r.ok !== "boolean") return errorOut(d);
  if (!r.ok) {
    if (r.reason === "bad_number" && typeof r.left === "number" && r.left > 0) return retry(`That number does not match. ${r.left === 1 ? "1 try" : `${r.left} tries`} left.`);
    if (r.reason === "bad_number") return errorOut(d, 400, "That number did not match three times, so this link has been cancelled. Go back to the app and start again.");
    return errorOut(d);
  }
  if (!r.ok || !isAllowedPath(r.path)) { await d.edge({ action: "complete", code, ok: false, reason: "bad_destination" }); return errorOut(d); }
  const uid = await d.exchange(r.token_hash).catch(() => null);
  if (uid !== r.user_id) {
    if (uid) await d.signOut().catch(() => undefined);                                                           // a session for anybody else is never kept
    await d.edge({ action: "complete", code, ok: false, reason: "exchange_failed" });
    return errorOut(d);
  }
  await d.edge({ action: "complete", code, ok: true });                                                          // "redeemed" is recorded only now, with the session in place
  return { status: 303, headers: { ...securityHeaders(), Location: new URL(r.path, d.origin).toString() }, body: "", cookies: [csrfCookie(d, "", 0)] };
}
