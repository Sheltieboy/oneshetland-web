"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Keeps a job page current while it is open: re-reads it from the server every so often, only while the tab is visible. */
export function LiveRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") router.refresh(); };
    const t = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [router, seconds]);
  return null;
}
