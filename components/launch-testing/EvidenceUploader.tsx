"use client";
/* eslint-disable @next/next/no-img-element -- private, short-lived signed URLs and local previews: next/image cannot optimise them */

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { registerAttachmentAction } from "@/lib/launch-testing/actions";
import { checkEvidence, evidencePath, MAX_EVIDENCE_PER_ATTEMPT } from "@/lib/launch-testing/evidence";

const BUCKET = "launch-test-evidence";

/**
 * Optional screenshots. The browser uploads straight into the PRIVATE bucket under `<attempt id>/<generated id>.<ext>` — the only place the
 * database lets this person write — and then records it. A picture is checked here for a friendly message; the database is the real gate.
 */
export function EvidenceUploader({ attemptId, existing }: { attemptId: string; existing: Array<{ id: string; url: string | null }> }) {
  const input = useRef<HTMLInputElement>(null);
  const [added, setAdded] = useState<Array<{ id: string; preview: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = existing.length + added.length;

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null); setBusy(true);
    try {
      const sb = createClient();
      let count = total;
      for (const file of Array.from(files)) {
        const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
        const check = checkEvidence({ type: file.type, size: file.size }, head, count);
        if (!check.ok) { setError(check.error); break; }
        const path = evidencePath(attemptId, crypto.randomUUID(), check.ext);
        const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: check.mime, upsert: false, cacheControl: "3600" });
        if (up.error) { setError("That picture could not be uploaded. Please try again."); break; }
        const reg = await registerAttachmentAction({ attemptId, path, mime: check.mime, size: file.size });
        if (!reg.ok) { setError(reg.error); break; }
        count++;
        setAdded((a) => [...a, { id: reg.id, preview: URL.createObjectURL(file) }]);
      }
    } finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  return (
    <div>
      <p className="text-sm font-semibold text-ink">Add a screenshot <span className="font-normal text-ink-muted">(optional)</span></p>
      <div className="mt-2 flex flex-wrap gap-2">
        {existing.map((e) => e.url && <img key={e.id} src={e.url} alt="Screenshot you added" className="h-20 w-20 rounded-lg border border-line object-cover" />)}
        {added.map((a) => <img key={a.id} src={a.preview} alt="Screenshot you added" className="h-20 w-20 rounded-lg border border-line object-cover" />)}
      </div>
      {total < MAX_EVIDENCE_PER_ATTEMPT && (
        <>
          <input ref={input} type="file" accept="image/*" multiple className="sr-only" id="evidence-input" onChange={(e) => onFiles(e.target.files)} disabled={busy} />
          <label htmlFor="evidence-input" className={"mt-2 inline-flex min-h-[48px] cursor-pointer items-center rounded-pill border-2 border-line bg-paper px-5 text-sm font-bold text-ink " + (busy ? "opacity-60" : "")}>
            {busy ? "Uploading…" : total ? "Add another picture" : "Choose a picture"}
          </label>
        </>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
