"use client";

import { useState } from "react";

/** Share this page: the device's own share sheet where there is one, otherwise copy the address. Nothing is sent anywhere by us. */
export function ShareLink({ title, path }: { title: string; path: string }) {
  const [note, setNote] = useState("");
  const go = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      if (typeof navigator.share === "function") { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url); setNote("Link copied");
    } catch { setNote(typeof navigator.share === "function" ? "" : "Copy the address from your browser"); }
    window.setTimeout(() => setNote(""), 3000);
  };
  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" onClick={go} className="ed-plan">Share<span className="sr-only"> {title}</span></button>
      <span role="status" className="ed-small ed-muted" style={{ minHeight: "1.1rem" }}>{note}</span>
    </span>
  );
}
