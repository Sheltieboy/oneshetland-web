"use client";

import { QRCodeSVG } from "qrcode.react";
import { hubAccent, HUB_TYPE_LABELS, membershipPrice, isMembershipActive, type HubMember } from "@/lib/hubs-data";

export function MembershipCard({ m }: { m: HubMember }) {
  const hub = m.hub;
  if (!hub) return null;
  const accent = hubAccent(hub);
  const code = `oneshetland:hub:${hub.id}:member:${m.member_no ?? m.user_id}`;
  const valid = isMembershipActive(m);

  return (
    <div className="overflow-hidden rounded-2xl shadow-lift" style={{ background: accent }}>
      <div className="flex items-start justify-between gap-4 p-5 text-paper">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {hub.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hub.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : null}
            <span className="font-display text-lg font-bold">{hub.name}</span>
            <span
              className="rounded-pill px-2.5 py-0.5 text-xs font-bold"
              style={valid ? { background: "rgba(255,255,255,0.22)", color: "#fff" } : { background: "#B45309", color: "#fff" }}
            >
              {valid ? "Active" : "Expired"}
            </span>
          </div>
          <p className="mt-1 text-sm text-paper/85">{HUB_TYPE_LABELS[hub.type]}</p>
          <div className="mt-4 text-sm text-paper/90">
            {m.membership_type ? (
              <p className="font-semibold">{m.membership_type.name} · {membershipPrice(m.membership_type.price_pence, m.membership_type.period)}</p>
            ) : (
              <p className="font-semibold capitalize">{m.role}</p>
            )}
            {m.member_no && <p className="mt-0.5">Member no. {m.member_no}</p>}
            {m.paid_until && (
              <p className="mt-0.5">
                {valid ? "Renews" : "Expired"} {new Date(m.paid_until).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}
          </div>
        </div>
        <div className="rounded-xl bg-paper p-2">
          <QRCodeSVG value={code} size={84} />
        </div>
      </div>
    </div>
  );
}
