"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { REGULAR } from "./tokens";

/**
 * Follow an activity to hear when a session is cancelled or changed. Opt-in, private, and exact about what it does: in this first version the ONLY
 * thing a follower receives is a note in their OneShetland Notification Centre. No email, no phone alert, no reminders. The wording below must
 * stay true to that; a test pins it.
 */
export function FollowButton({ activityId, slug, signedIn, following: initial, tone = "light" }: { activityId: string; slug: string; signedIn: boolean; following: boolean; tone?: "light" | "onDark" }) {
  const dark = tone === "onDark";
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <div>
        <Link href={`/sign-in?next=${encodeURIComponent(`/whats-on/regular/${slug}`)}`} className={"inline-block rounded-pill px-5 py-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none " + (dark ? "bg-white text-ink shadow-soft hover:bg-cream" : "border border-line-strong text-ink hover:bg-sand")}>
          Sign in to follow
        </Link>
        <p className={"mt-1.5 max-w-sm text-xs " + (dark ? "text-white/85" : "text-ink-muted")}>Following adds a note to your OneShetland notifications if a session is cancelled or changed, and when the organiser sends an occasional message. No emails or phone alerts yet, and no reminders.</p>
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
        className={"rounded-pill px-5 py-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 motion-reduce:transition-none " + (dark ? (following ? "border border-white/80 text-white hover:bg-white/10" : "bg-white text-ink shadow-soft hover:bg-cream") : (following ? "border border-line-strong text-ink hover:bg-sand" : "text-paper"))}
        style={following || dark ? undefined : { background: REGULAR }}
      >
        {following ? "Following · tap to stop" : "Follow this activity"}
      </button>
      <p className={"mt-1.5 max-w-sm text-xs " + (dark ? "text-white/85" : "text-ink-muted")} aria-live="polite">
        {err ?? (following ? "You'll get a note in your OneShetland notifications if a session is cancelled or changed, and when the organiser sends an occasional message. No emails or phone alerts yet, and no reminders. You can turn What's On notifications off in your notification settings, or stop following at any time." : "Get a note in your OneShetland notifications if a session is cancelled or changed, and when the organiser sends an occasional message. No emails or phone alerts yet, and no reminders.")}</p>
    </div>
  );
}
