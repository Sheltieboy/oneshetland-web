"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isFollowingBusiness,
  followBusiness,
  unfollowBusiness,
} from "@/lib/follows-data";

/**
 * Follow / unfollow a business — web mirror of the app's hero follow button.
 * Optimistic toggle; gated on login (sends logged-out users to signInHref).
 */
export function FollowButton({
  businessId,
  accent,
  isLoggedIn,
  signInHref,
}: {
  businessId: string;
  accent: string;
  isLoggedIn: boolean;
  signInHref: string;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    let live = true;
    isFollowingBusiness(businessId)
      .then((f) => { if (live) setFollowing(f); })
      .catch(() => {});
    return () => { live = false; };
  }, [businessId, isLoggedIn]);

  async function toggle() {
    if (!isLoggedIn) { router.push(signInHref); return; }
    if (busy) return;
    const next = !following;
    setFollowing(next); // optimistic
    setBusy(true);
    try {
      if (next) await followBusiness(businessId);
      else await unfollowBusiness(businessId);
    } catch {
      setFollowing(!next); // revert on failure
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      className="inline-flex items-center gap-2 rounded-pill px-5 py-2 text-sm font-bold shadow-soft backdrop-blur-sm transition disabled:opacity-70"
      style={
        following
          ? { background: "rgba(255,255,255,0.18)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.7)" }
          : { background: "#fff", color: accent }
      }
    >
      <span aria-hidden>{following ? "✓" : "+"}</span>
      {following ? "Following" : "Follow"}
    </button>
  );
}
