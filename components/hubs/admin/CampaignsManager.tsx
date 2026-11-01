"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCampaign, updateCampaign } from "@/lib/hubs-client";
import { gbp } from "@/lib/currency";
import type { HubCampaign } from "@/lib/hubs-data";
import { CAMPAIGN_PUBLISH_BLOCKED, campaignWriteMessage } from "@/lib/campaign-payout-state";

/**
 * @param payoutReady resolved on the server by hub_payout_ready(): the rule the database enforces when a campaign is
 *   published or reopened. Passed in, never inferred in the browser.
 * @param payoutHref the hub's payouts page, carrying its return target.
 */
export function CampaignsManager({ hubId, campaigns, accent, payoutReady, payoutHref }: { hubId: string; campaigns: HubCampaign[]; accent: string; payoutReady: boolean; payoutHref: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!payoutReady) return setError(CAMPAIGN_PUBLISH_BLOCKED.title + ".");
    const goalPence = Math.round((parseFloat(goal) || 0) * 100);
    if (!title.trim() || goalPence <= 0) return setError("Add a title and a goal amount.");
    setError(null);
    setBusy(true);
    try {
      await createCampaign(hubId, { title: title.trim(), story: story.trim() || undefined, goal_pence: goalPence });
      setTitle(""); setStory(""); setGoal("");
      router.refresh();
    } catch (e) {
      setError(campaignWriteMessage(e, "Could not create campaign."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!payoutReady && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-900">{CAMPAIGN_PUBLISH_BLOCKED.title}</p>
          <p className="mt-0.5 text-sm text-amber-900/80">{CAMPAIGN_PUBLISH_BLOCKED.body}</p>
          <Link href={payoutHref} className="mt-3 inline-block rounded-pill px-4 py-2 text-sm font-semibold text-paper" style={{ background: accent }}>{CAMPAIGN_PUBLISH_BLOCKED.cta} →</Link>
        </div>
      )}
      <form onSubmit={create} className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">New campaign</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Campaign title" className="auth-input" />
        <input value={goal} onChange={(e) => setGoal(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Goal £" className="auth-input" />
        <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={3} placeholder="Why are you fundraising?" className="auth-input" />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        <button type="submit" disabled={busy || !payoutReady} className="rounded-pill px-5 py-2.5 font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>
          {busy ? "Creating…" : "Create campaign"}
        </button>
      </form>

      <ul className="space-y-2">
        {campaigns.map((c) => (
          <li key={c.id} className="rounded-xl border border-line bg-paper p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/hubs/campaign/${c.id}`} className="font-semibold text-ink hover:underline">{c.title}</Link>
              <span className={"rounded-pill px-2 py-0.5 text-xs font-semibold " + (c.status === "active" ? "text-paper" : "bg-sand text-ink-muted")}
                style={c.status === "active" ? { background: accent } : undefined}>{c.status}</span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{gbp(c.raised_pence)} of {gbp(c.goal_pence)} · {c.donor_count} supporters</p>
            {/* Closing is always allowed; reopening publishes again, so it needs payouts (the database enforces this too). */}
            <button
              disabled={c.status !== "active" && !payoutReady}
              title={c.status !== "active" && !payoutReady ? CAMPAIGN_PUBLISH_BLOCKED.title : undefined}
              onClick={async () => {
                try { await updateCampaign(c.id, { status: c.status === "active" ? "closed" : "active" }); setError(null); router.refresh(); }
                catch (err) { setError(campaignWriteMessage(err, "Could not update campaign.")); }
              }}
              className="mt-2 rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-50">
              {c.status === "active" ? "Close campaign" : "Reopen"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
