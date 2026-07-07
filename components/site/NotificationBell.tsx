"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchUnreadCount } from "@/lib/notifications-inbox";

export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => fetchUnreadCount().then(setCount).catch(() => {});
    refresh();
    // Refetch the unread badge whenever the tab/window regains focus, so the
    // count stays fresh after the user reads notifications in another tab.
    const onFocus = () => refresh();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      className="relative grid h-9 w-9 place-items-center rounded-full border border-line-strong text-ink transition-colors hover:bg-sand"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-[17px] place-items-center rounded-full border border-paper bg-[#E53935] px-1 text-[10px] font-bold leading-[15px] text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
