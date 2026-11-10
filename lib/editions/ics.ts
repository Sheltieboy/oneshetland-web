/**
 * Calendar export (RFC 5545). Pure: no I/O. Times are exported in UTC so no timezone database is needed by the reader; every line is folded
 * at 75 octets and ends in CRLF; text is escaped. A cancelled item stays in the file as STATUS:CANCELLED so a calendar that already has it
 * shows it cancelled instead of silently keeping a stale entry.
 */
export type IcsItem = { uid: string; title: string; starts_at: string; ends_at?: string | null; location?: string | null; description?: string | null; url?: string | null; status?: string | null };

export const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\n|\r/g, "\\n");
const pad = (n: number) => String(n).padStart(2, "0");
export function icsUtc(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
/** Fold a content line to 75 octets (not characters), continuing with a single space. */
export function icsFold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = []; let cur = "", bytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { out.push(cur); cur = " "; bytes = 1; limit = 75; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n");
}

export function buildIcs(opts: { name: string; items: IcsItem[]; now?: Date; domain?: string }): string {
  const domain = opts.domain ?? "oneshetland.com";
  const stamp = icsUtc((opts.now ?? new Date()).toISOString());
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OneShetland//Editions//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEscape(opts.name)}`];
  for (const it of opts.items) {
    const end = it.ends_at && Date.parse(it.ends_at) > Date.parse(it.starts_at) ? it.ends_at : new Date(Date.parse(it.starts_at) + 3600_000).toISOString();
    lines.push("BEGIN:VEVENT", `UID:${it.uid}@${domain}`, `DTSTAMP:${stamp}`, `DTSTART:${icsUtc(it.starts_at)}`, `DTEND:${icsUtc(end)}`, `SUMMARY:${icsEscape(it.title)}`);
    if (it.location) lines.push(`LOCATION:${icsEscape(it.location)}`);
    const desc = [it.description?.trim(), it.url].filter(Boolean).join("\n\n");
    if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
    if (it.url) lines.push(`URL:${it.url}`);
    if (it.status === "cancelled") lines.push("STATUS:CANCELLED");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(icsFold).join("\r\n") + "\r\n";
}
