"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchInbox, markNotificationsRead, webNotificationRoute, categoryAccent,
  type InboxNotification,
} from "@/lib/notifications-inbox";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function NotificationInbox() {
  const router = useRouter();
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInbox().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const onTap = (item: InboxNotification) => {
    if (!item.read_at) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i)));
      markNotificationsRead([item.id]).catch(() => {});
    }
    const route = webNotificationRoute(item.data);
    if (route) router.push(route);
  };

  const markAll = () => {
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
    markNotificationsRead().catch(() => {});
  };

  const hasUnread = items.some((i) => !i.read_at);

  if (loading) {
    return <p className="mt-6 text-ink-muted">Loading…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-line bg-paper p-10 text-center">
        <p className="font-display text-lg font-semibold text-ink">Nothing yet</p>
        <p className="mt-1 text-ink-soft">Your notifications will appear here.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {hasUnread && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={markAll}
            className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-sand"
          >
            Mark all read
          </button>
        </div>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper">
        {items.map((item) => {
          const unread = !item.read_at;
          const linkable = !!webNotificationRoute(item.data);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onTap(item)}
                className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-sand ${unread ? "bg-sand/40" : ""} ${linkable ? "" : "cursor-default"}`}
              >
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: unread ? categoryAccent(item.category) : "transparent" }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{item.title}</span>
                  <span className="mt-0.5 block text-sm text-ink-soft">{item.body}</span>
                  <span className="mt-1 block text-xs text-ink-muted">{relativeTime(item.created_at)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
