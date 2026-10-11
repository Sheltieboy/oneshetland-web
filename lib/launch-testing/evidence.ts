/**
 * evidence.ts — checks on a screenshot before it is uploaded, and the one shape of storage path the database accepts.
 *
 * The database is the real gatekeeper (private bucket, 5 MB, image types, path must be `<attempt id>/<generated uuid>.<ext>` under an attempt the
 * caller owns). These checks only give the tester a clear message early and refuse a file that is not really an image.
 */
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const MAX_EVIDENCE_PER_ATTEMPT = 4;

export const EVIDENCE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif",
};

export type EvidenceCheck = { ok: true; mime: string; ext: string } | { ok: false; error: string };

/** What the first bytes of a file say it is. Browsers can label a file with any type, so the label alone is not trusted. */
export function sniffImageType(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["mif1", "msf1", "heim", "heis"].includes(brand)) return "image/heif";
  }
  return null;
}

export function checkEvidence(file: { type: string; size: number }, head: Uint8Array, already = 0): EvidenceCheck {
  if (already >= MAX_EVIDENCE_PER_ATTEMPT) return { ok: false, error: `You can add up to ${MAX_EVIDENCE_PER_ATTEMPT} screenshots.` };
  if (file.size <= 0) return { ok: false, error: "That file is empty." };
  if (file.size > MAX_EVIDENCE_BYTES) return { ok: false, error: "That picture is too big. Please choose one under 5 MB." };
  const sniffed = sniffImageType(head);
  if (!sniffed) return { ok: false, error: "Please choose a picture (a photo or screenshot)." };
  if (file.type && EVIDENCE_TYPES[file.type] === undefined && file.type !== "") return { ok: false, error: "Please choose a JPEG, PNG, WebP or HEIC picture." };
  return { ok: true, mime: sniffed, ext: EVIDENCE_TYPES[sniffed] };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** `<attempt id>/<new uuid>.<ext>` — the client never chooses a name. */
export function evidencePath(attemptId: string, newId: string, ext: string): string {
  if (!UUID.test(attemptId) || !UUID.test(newId)) throw new Error("Bad id for evidence path");
  if (!Object.values(EVIDENCE_TYPES).includes(ext)) throw new Error("Bad extension for evidence path");
  return `${attemptId}/${newId}.${ext}`;
}
