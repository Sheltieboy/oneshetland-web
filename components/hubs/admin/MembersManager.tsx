"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveMember, rejectMember, setMemberRole } from "@/lib/hubs-client";
import type { HubMember } from "@/lib/hubs-data";

export function MembersManager({ pending, members, accent }: { pending: HubMember[]; members: HubMember[]; accent: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try { await fn(); router.refresh(); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-xl font-bold">Pending requests ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No requests waiting.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {pending.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft">
                <span className="font-semibold text-ink">{m.profile?.full_name || "Member"}</span>
                <div className="flex gap-2">
                  <button onClick={() => run(m.id, () => rejectMember(m.id))} disabled={busy === m.id}
                    className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-50">Decline</button>
                  <button onClick={() => run(m.id, () => approveMember(m.id))} disabled={busy === m.id}
                    className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>Approve</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">Members ({members.length})</h2>
        <ul className="mt-4 space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft">
              <div>
                <span className="font-semibold text-ink">{m.profile?.full_name || "Member"}</span>
                <span className="ml-2 rounded-pill bg-sand px-2 py-0.5 text-xs font-semibold capitalize text-ink-muted">{m.role}</span>
              </div>
              {m.role !== "owner" && (
                <button
                  onClick={() => run(m.id, () => setMemberRole(m.id, m.role === "committee" ? "member" : "committee"))}
                  disabled={busy === m.id}
                  className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-50"
                >
                  {m.role === "committee" ? "Remove from committee" : "Make committee"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
