"use client";

import { useState } from "react";
import { ImageUpload } from "./ImageUpload";
import { btnSecondary } from "./kit";

/**
 * Uploading a photograph for a PAGE. Pages have no image column — a page body refers to a picture by
 * its address inside a ::: block — so this uploads through the normal organiser route (the
 * `edition-media` bucket, path prefixed with the organiser id, renditions generated) and then hands
 * the author the address to paste. No custom scripting, and nothing here bypasses the storage rules.
 */
export function PageImageHelper({ organiserId }: { organiserId: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const snippet = url ? `::: figure src=${url} alt="Describe the picture" ratio=16x9\n:::` : "";
  return (
    <div className="mt-4 rounded-card border border-line bg-cream/40 p-4">
      <p className="text-sm font-semibold text-ink">Add a photograph</p>
      <p className="mb-3 mt-0.5 text-xs text-ink-muted">Upload it here, then paste the block into your page wherever you want it to appear.</p>
      <ImageUpload label="Page photograph" organiserId={organiserId} kind="page-image" value={url} onChange={setUrl}
        hint="JPEG, PNG or WebP, up to 10 MB. Landscape pictures work best in a full-width band." />
      {url && (
        <div className="mt-3">
          <textarea readOnly rows={2} value={snippet} className="w-full rounded border border-line bg-paper p-2 font-mono text-xs text-ink" aria-label="Block to paste into your page" />
          <button type="button" className={btnSecondary + " mt-2"}
            onClick={async () => { try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* select it by hand */ } }}>
            {copied ? "Copied" : "Copy block"}
          </button>
        </div>
      )}
    </div>
  );
}
