/**
 * upload.ts — one photo or document: ask the server for a one-use upload, send the file straight to that private address, then ask
 * the server to check and register it. Only JPEG/PNG/WEBP up to 10 MB are offered; the server checks the real bytes again.
 */
import type { FetchResult } from "@/lib/fetch-api";
import { photoProblem } from "@/lib/fetch/flow";

export async function uploadOne(file: File, begin: (mime: string, size: number) => Promise<FetchResult<{ upload_id: string; upload_url: string }>>,
                                submit: (uploadId: string) => Promise<FetchResult<unknown>>): Promise<{ ok: true } | { ok: false; message: string }> {
  const problem = photoProblem(file);
  if (problem) return { ok: false, message: problem };
  const b = await begin(file.type, file.size);
  if (!b.ok) return { ok: false, message: b.message };
  let put: Response;
  try {
    put = await fetch(b.data.upload_url, { method: "PUT", headers: { "content-type": file.type, "x-upsert": "false" }, body: file });
  } catch { return { ok: false, message: "The upload didn't go through. Please check your connection and try again." }; }
  if (!put.ok) return { ok: false, message: "The upload didn't go through. Please try again." };
  const s = await submit(b.data.upload_id);
  return s.ok ? { ok: true } : { ok: false, message: s.message };
}
