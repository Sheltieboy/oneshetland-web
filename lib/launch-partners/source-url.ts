/**
 * The address a launch-partner draft is built from. Pure — shared by the Admin screen and the server.
 *
 * Only an https address on a NAMED site is ever read. Anything typed without a scheme gets https://; a plain http:// address
 * is upgraded to https://; credentials, odd ports, IP addresses and internal host names are refused (the fetcher refuses
 * them again, on every redirect hop, after resolving the name — this is the polite early answer, not the only guard).
 */
export type SourceUrl = { ok: true; url: string; host: string } | { ok: false; error: string };

const INTERNAL_NAME = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/i;

export function normaliseSourceUrl(input: string | null | undefined): SourceUrl {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: "Add the business's website address." };
  if (raw.length > 2048 || /\s/.test(raw)) return { ok: false, error: "That doesn't look like a website address." };
  let withScheme = raw;
  if (/^http:\/\//i.test(raw)) withScheme = `https://${raw.slice(7)}`;
  else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[^/]*\.[^/]*[:/]/.test(raw)) return { ok: false, error: "Only website addresses (https://…) can be used." };
    withScheme = `https://${raw.replace(/^\/+/, "")}`;
  }
  let u: URL;
  try { u = new URL(withScheme); } catch { return { ok: false, error: "That doesn't look like a website address." }; }
  if (u.protocol !== "https:") return { ok: false, error: "Only website addresses (https://…) can be used." };
  if (u.username || u.password) return { ok: false, error: "Addresses with a username or password can't be used." };
  if (u.port && u.port !== "443") return { ok: false, error: "Only the standard https port can be used." };
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (/^[0-9.]+$/.test(host) || host.includes(":")) return { ok: false, error: "Use the website's name, not an IP address." };
  if (!host.includes(".") || INTERNAL_NAME.test(host)) return { ok: false, error: "That address points inside a private network." };
  u.hash = "";
  u.port = "";
  return { ok: true, url: u.toString(), host: host.replace(/^www\./, "") };
}

/** A short, human label for an address: "avrilthomsonsmith.co.uk". */
export const hostLabel = (url: string): string => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };
