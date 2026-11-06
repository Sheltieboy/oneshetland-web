"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { REGULAR } from "./tokens";

/**
 * Follow an activity to hear when a session is cancelled or changed. Opt-in, private, and honest about what it does: it is not a reminder, and
 * we say plainly that a notice may arrive in your OneShetland inbox rather than as a phone alert.
 */
export function FollowButton({ activityId, slug, signedIn, following: initial }: { activityId: string; slug: string; signedIn: boolean; following: boolean }) {
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <div>
        <Link href={`/sign-in?next=${encodeURIComponent(`/whats-on/regular/${slug}`)}`} className="inline-block rounded-pill border border-line-strong px-5 py-2.5 text-sm font-bold text-ink hover:bg-sand">
          Sign in to follow for changes
        </Link>
        <p className="mt-1.5 max-w-sm text-xs text-ink-muted">Following tells you if a session is cancelled or moved. It never sends reminders.</p>
      </div>
    );
  }
  async function toggle() {
    setBusy(true); setErr(null);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      if (following) {
        const { error } = await sb.from("activity_follows").delete().eq("activity_id", activityId).eq("user_id", user.id);
        if (error) throw error;
        setFollowing(false);
      } else {
        const { error } = await sb.from("activity_follows").insert({ activity_id: activityId, user_id: user.id });
        if (error && error.code !== "23505") throw error;
        setFollowing(true);
      }
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "Couldn't update that. Please try again.");
    } finally { setBusy(false); }
  }
  return (
    <div>
      <button
        type="button" onClick={() => void toggle()} disabled={busy} aria-pressed={following}
        className={"rounded-pill px-5 py-2.5 text-sm font-bold transition disabled:opacity-50 " + (following ? "border border-line-strong text-ink hover:bg-sand" : "text-paper")}
        style={following ? undefined : { background: REGULAR }}
      >
        {following ? "Following · tap to stop" : "Follow for changes"}
      </button>
      <p className="mt-1.5 max-w-sm text-xs text-ink-muted" aria-live="polite">
        {err ?? (following ? "We'll tell you if a session is cancelled or moved. Notices appear in your OneShetland inbox, and as a phone alert if you use the app." : "Hear if a session is cancelled or moved. No reminders.")}
      </p>
    </div>
  );
}
