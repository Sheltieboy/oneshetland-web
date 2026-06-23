"use client";

import { useState } from "react";
import Link from "next/link";
import { SlideOver } from "@/components/ui/SlideOver";
import { DonateModal } from "@/components/hubs/DonateModal";
import { gbp } from "@/lib/stripe";

type DirectoryEntry = { user_id: string; name: string; role: string; tier?: string | null };
type Donor = { name: string | null; amount_pence: number; is_anonymous: boolean };

type Campaign = {
  id: string;
  title: string;
  raised_pence: number;
  goal_pence: number;
  donor_count: number;
  status: string;
};

export function DirectoryButton({
  hubId,
  hubSlug,
  accent,
  members,
}: {
  hubId: string;
  hubSlug: string;
  accent: string;
  members: DirectoryEntry[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="block w-full rounded-xl border border-line bg-paper p-4 text-center font-semibold shadow-soft transition hover:border-current"
        style={{ color: accent }}
      >
        View member directory →
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Member directory"
        subtitle={`${members.length} member${members.length === 1 ? "" : "s"}`}
        accent={accent}
      >
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold text-paper" style={{ background: accent }}>
                  {(m.name || "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="font-semibold text-ink">{m.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {m.tier && <span className="rounded-pill bg-sand px-2 py-0.5 text-xs font-semibold text-ink-muted">{m.tier}</span>}
                {m.role !== "member" && (
                  <span className="rounded-pill px-2 py-0.5 text-xs font-semibold capitalize text-paper" style={{ background: accent }}>{m.role}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
        {/* Keep the full-page link for admins who need it */}
        <p className="mt-4 text-center text-xs text-ink-muted">
          <Link href={`/hubs/${hubSlug}/directory`} className="hover:underline" style={{ color: accent }}>
            Open full page →
          </Link>
        </p>
      </SlideOver>
    </>
  );
}

export function CampaignSidebar({
  campaign,
  donors,
  hubName,
  accent,
  isCharity,
  isLoggedIn,
  signInHref,
}: {
  campaign: Campaign;
  donors: Donor[];
  hubName: string;
  accent: string;
  isCharity: boolean;
  isLoggedIn: boolean;
  signInHref: string;
}) {
  const [donateOpen, setDonateOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
        <p className="eyebrow" style={{ color: accent }}>Fundraising</p>
        <h3 className="mt-1 font-display text-lg font-bold">{campaign.title}</h3>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sand">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, (campaign.raised_pence / campaign.goal_pence) * 100)}%`, background: accent }}
          />
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          <span className="font-bold text-ink">{gbp(campaign.raised_pence)}</span> of {gbp(campaign.goal_pence)}
          {campaign.donor_count > 0 ? ` · ${campaign.donor_count} supporter${campaign.donor_count === 1 ? "" : "s"}` : ""}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setDonateOpen(true)}
            disabled={campaign.status === "closed"}
            className="flex-1 rounded-pill px-4 py-2.5 text-center text-sm font-semibold text-paper transition hover:brightness-95 disabled:opacity-50"
            style={{ background: accent }}
          >
            Donate
          </button>
          <Link
            href={`/hubs/campaign/${campaign.id}`}
            className="rounded-pill border border-line-strong px-4 py-2.5 text-center text-sm font-semibold text-ink transition hover:bg-sand"
          >
            Full story
          </Link>
        </div>

        {donors.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-xs font-semibold text-ink-muted">Recent supporters</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {donors.slice(0, 4).map((d, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate text-ink-soft">{d.is_anonymous ? "Anonymous" : d.name}</span>
                  <span className="font-semibold text-ink">{gbp(d.amount_pence)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <DonateModal
        open={donateOpen}
        onClose={() => setDonateOpen(false)}
        campaignId={campaign.id}
        hubName={hubName}
        accent={accent}
        isCharity={isCharity}
        isLoggedIn={isLoggedIn}
        signInHref={signInHref}
      />
    </>
  );
}
