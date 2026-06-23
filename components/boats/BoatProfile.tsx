"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  type VesselProfile, type VesselEditProposal, type EditAction, type EditTable, type Confidence,
  hullMaterialLabel, confidenceLabel, confidenceTone, vesselDisplayTitle, buildEditSummary, dedupeRows, confRankOf, BOATS,
} from "@/lib/boats-data";

type Target = {
  table: EditTable; rowId: string | null; column: string | null; label: string;
  currentValue: string | null; actions: EditAction[]; valueType?: "text" | "year" | "number"; addKey?: string;
};
const TONE: Record<string, string> = { green: "bg-emerald-100 text-emerald-700", blue: "bg-blue-100 text-blue-700", amber: "bg-amber-100 text-amber-700", gray: "bg-sand text-ink-muted", red: "bg-rose-100 text-rose-700" };

function ConfPill({ c }: { c: Confidence | null }) {
  if (!c) return null;
  return <span className={"rounded-pill px-2 py-0.5 text-[11px] font-bold " + TONE[confidenceTone(c)]}>{confidenceLabel(c)}</span>;
}

export function BoatProfile({ profile, edits, myVotes, isLoggedIn, userId }: {
  profile: VesselProfile; edits: VesselEditProposal[]; myVotes: Record<string, "confirm" | "dispute">; isLoggedIn: boolean; userId: string | null;
}) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const v = profile.vessel;

  const openCount = edits.filter((e) => e.status === "open").length;
  const proposalsFor = (t: Target) => edits.filter((e) => e.status === "open" && e.target_table === t.table && (e.target_column ?? null) === (t.column ?? null) && (e.target_row_id ?? null) === (t.rowId ?? null));
  const pendingCount = (t: Target) => proposalsFor(t).length;

  const Pencil = ({ t }: { t: Target }) => editMode ? (
    <button onClick={() => setTarget(t)} className="ml-2 rounded-pill border border-line-strong px-2 py-0.5 text-[11px] font-semibold text-ink-soft hover:bg-sand">
      ✎ suggest{pendingCount(t) > 0 ? ` · ${pendingCount(t)}` : ""}
    </button>
  ) : pendingCount(t) > 0 ? (
    <button onClick={() => setTarget(t)} className="ml-2 rounded-pill bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{pendingCount(t)} pending</button>
  ) : null;

  // ── deduped sections ──
  const nameGroups = dedupeRows(profile.names, (n) => `${(n.normalised_name ?? n.name).toLowerCase()}|${n.start_year}|${n.end_year}|${n.date_text}`, (n) => confRankOf(n.confidence, n.is_primary));
  const regGroups = dedupeRows(profile.registrations, (r) => `${r.registration.toLowerCase()}|${r.start_year}|${r.end_year}`, (r) => confRankOf(r.confidence, r.is_primary));
  const ownGroups = dedupeRows(profile.ownerships, (o) => `${(o.owner?.name ?? "").toLowerCase()}|${o.start_year}|${o.end_year}`, (o) => confRankOf(o.confidence));

  const yrs = (a: number | null, b: number | null, t: string | null) => t || (a && b ? `${a}–${b}` : a ? `from ${a}` : b ? `to ${b}` : "");

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="rounded-card border border-line bg-paper p-6 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {v.primary_lk_number && <p className="text-sm font-black uppercase tracking-wide" style={{ color: BOATS }}>{v.primary_lk_number}<Pencil t={{ table: "vessels", rowId: null, column: "primary_lk_number", label: "LK number", currentValue: v.primary_lk_number, actions: ["edit"] }} /></p>}
            <h2 className="font-display text-3xl font-bold text-ink">{v.canonical_name}<Pencil t={{ table: "vessels", rowId: null, column: "canonical_name", label: "Name", currentValue: v.canonical_name, actions: ["edit"] }} /></h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <span>{v.built_year ? `Built ${v.built_year}` : "Year unknown"}<Pencil t={{ table: "vessels", rowId: null, column: "built_year", label: "Built year", currentValue: v.built_year?.toString() ?? null, actions: ["edit"], valueType: "year" }} /></span>
              {hullMaterialLabel(v.hull_material) && <span>· {hullMaterialLabel(v.hull_material)}</span>}
              {v.builder && <span>· {v.builder}<Pencil t={{ table: "vessels", rowId: null, column: "builder", label: "Builder", currentValue: v.builder, actions: ["edit"] }} /></span>}
            </div>
            <div className="mt-2"><ConfPill c={v.identity_confidence} />{v.identity_notes && <span className="ml-2 text-sm text-ink-muted">{v.identity_notes}</span>}</div>
          </div>
          <button onClick={() => setEditMode((m) => !m)} className={"shrink-0 rounded-pill px-4 py-2 text-sm font-semibold " + (editMode ? "text-white" : "border border-line-strong text-ink hover:bg-sand")} style={editMode ? { background: BOATS } : undefined}>
            {editMode ? "Done" : "✎ Suggest edits"}{!editMode && openCount > 0 ? ` (${openCount})` : ""}
          </button>
        </div>
        {editMode && <p className="mt-3 rounded-lg bg-sand/60 px-3 py-2 text-sm text-ink-soft">Tap “suggest” by any detail to propose a change. Other folk vote — 3 agrees and it's applied. Help keep da history right.</p>}
      </section>

      <Section title="Names she went by" onAdd={editMode ? () => setTarget({ table: "vessel_names", rowId: null, column: null, label: "a name she went by", currentValue: null, actions: ["add"], addKey: "name" }) : undefined}>
        {nameGroups.map(({ rep, others }) => (
          <Row key={rep.id} title={rep.name} meta={yrs(rep.start_year, rep.end_year, rep.date_text)} primary={rep.is_primary} conf={rep.confidence} dupes={others.length}
            pencil={<Pencil t={{ table: "vessel_names", rowId: rep.id, column: "name", label: "name", currentValue: rep.name, actions: ["edit", "remove"] }} />} />
        ))}
      </Section>

      <Section title="Numbers she carried" onAdd={editMode ? () => setTarget({ table: "registrations", rowId: null, column: null, label: "a registration number", currentValue: null, actions: ["add"], addKey: "registration" }) : undefined}>
        {regGroups.map(({ rep, others }) => (
          <Row key={rep.id} title={rep.registration} meta={yrs(rep.start_year, rep.end_year, rep.date_text)} primary={rep.is_primary} conf={rep.confidence} dupes={others.length}
            pencil={<Pencil t={{ table: "registrations", rowId: rep.id, column: "registration", label: "number", currentValue: rep.registration, actions: ["edit", "remove"] }} />} />
        ))}
      </Section>

      <Section title="Owners through the years" onAdd={editMode ? () => setTarget({ table: "ownership_periods", rowId: null, column: null, label: "a previous owner", currentValue: null, actions: ["add"], addKey: "owner" }) : undefined}>
        {ownGroups.map(({ rep, others }) => (
          <Row key={rep.id} title={rep.owner?.name ?? "Unknown owner"} meta={yrs(rep.start_year, rep.end_year, rep.date_text)} conf={rep.confidence} dupes={others.length}
            pencil={<Pencil t={{ table: "ownership_periods", rowId: rep.id, column: "date_text", label: "ownership dates", currentValue: rep.date_text, actions: ["edit", "remove"] }} />} />
        ))}
      </Section>

      <Section title="Her size" onAdd={editMode ? () => setTarget({ table: "measurements", rowId: null, column: null, label: "a measurement", currentValue: null, actions: ["add"], addKey: "length_m" }) : undefined}>
        {profile.measurements.map((m) => (
          <Row key={m.id} title={[m.length_m ? `${m.length_m} m` : null, m.tonnage_text || (m.tonnage ? `${m.tonnage} tons` : null), m.engine_power_kw ? `${m.engine_power_kw} kW` : null].filter(Boolean).join(" · ") || "—"} meta={[m.measurement_year ? `recorded ${m.measurement_year}` : "", m.notes ?? ""].filter(Boolean).join(" · ")}
            pencil={<Pencil t={{ table: "measurements", rowId: m.id, column: "length_m", label: "length (m)", currentValue: m.length_m?.toString() ?? null, actions: ["edit", "remove"], valueType: "number" }} />} />
        ))}
      </Section>

      {target && (
        <SuggestModal target={target} vesselId={v.id} isLoggedIn={isLoggedIn} userId={userId}
          proposals={proposalsFor(target)} myVotes={myVotes}
          onClose={() => setTarget(null)} onChanged={() => router.refresh()} />
      )}
    </div>
  );
}

function Section({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: () => void }) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <section className="rounded-card border border-line bg-paper p-6 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-xl font-bold text-ink">{title}</h3>
        {onAdd && <button onClick={onAdd} className="rounded-pill border border-line-strong px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-sand">+ Suggest</button>}
      </div>
      {isEmpty ? <p className="text-sm text-ink-muted">Nothing recorded yet.</p> : <div className="divide-y divide-line">{children}</div>}
    </section>
  );
}

function Row({ title, meta, primary, conf, dupes, pencil }: { title: string; meta?: string; primary?: boolean; conf?: Confidence | null; dupes?: number; pencil?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-2.5">
      <span className="font-semibold text-ink">{title}</span>
      {primary && <span className="rounded-pill bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">main</span>}
      {conf && <ConfPill c={conf} />}
      {meta && <span className="text-sm text-ink-muted">{meta}</span>}
      {dupes ? <span className="text-xs text-ink-faint">+{dupes} duplicate{dupes === 1 ? "" : "s"} merged</span> : null}
      {pencil}
    </div>
  );
}

function SuggestModal({ target, vesselId, isLoggedIn, userId, proposals, myVotes, onClose, onChanged }: {
  target: Target; vesselId: string; isLoggedIn: boolean; userId: string | null;
  proposals: VesselEditProposal[]; myVotes: Record<string, "confirm" | "dispute">; onClose: () => void; onChanged: () => void;
}) {
  const [action, setAction] = useState<EditAction>(target.actions[0]);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localProps, setLocalProps] = useState(proposals);
  const [localVotes, setLocalVotes] = useState(myVotes);

  async function submit() {
    if (action !== "remove" && !value.trim()) { setError("Enter a value."); return; }
    setBusy(true); setError(null);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const summary = buildEditSummary({ action, label: target.label, value: value.trim(), currentValue: target.currentValue });
      const payload: Record<string, unknown> = action === "remove" ? {} : { value: value.trim(), ...(target.addKey ? { [target.addKey]: value.trim() } : {}) };
      const { error: dbErr } = await sb.from("vessel_edit_proposals").insert({
        vessel_id: vesselId, target_table: target.table, target_row_id: target.rowId, target_column: action === "edit" ? target.column : null,
        action, payload, current_value: target.currentValue, summary, note: note.trim() || null, proposed_by: user.id, status: "open",
      });
      if (dbErr) throw dbErr;
      setValue(""); setNote(""); onChanged();
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send suggestion."); }
    finally { setBusy(false); }
  }

  async function vote(id: string, v: "confirm" | "dispute") {
    try {
      await createClient().rpc("vote_vessel_edit", { p_proposal: id, p_vote: v });
      setLocalVotes((m) => ({ ...m, [id]: v }));
      setLocalProps((ps) => ps.map((p) => p.id === id ? { ...p, confirm_count: p.confirm_count + (v === "confirm" ? 1 : 0), dispute_count: p.dispute_count + (v === "dispute" ? 1 : 0) } : p));
      onChanged();
    } catch { /* */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-card bg-paper p-6 shadow-lift sm:rounded-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-ink">Suggest a change</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink">✕</button>
        </div>
        <p className="mt-1 text-sm text-ink-muted">{target.label} {target.currentValue ? <>· currently <b className="text-ink">{target.currentValue}</b></> : null}</p>

        {/* Existing proposals */}
        {localProps.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Suggestions so far</p>
            {localProps.map((p) => {
              const mine = p.proposed_by === userId; const voted = localVotes[p.id];
              return (
                <div key={p.id} className="rounded-card border border-line bg-sand/40 p-3">
                  <p className="text-sm font-semibold text-ink">{p.summary}</p>
                  {p.note && <p className="mt-0.5 text-sm text-ink-muted">“{p.note}”</p>}
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="font-semibold text-emerald-700">👍 {p.confirm_count}</span>
                    <span className="font-semibold text-rose-700">👎 {p.dispute_count}</span>
                    {mine ? <span className="text-ink-faint">Your suggestion — waiting for others</span>
                      : !isLoggedIn ? <span className="text-ink-faint">Sign in to vote</span>
                      : voted ? <span className="text-ink-faint">You voted “{voted}”</span>
                      : <>
                          <button onClick={() => vote(p.id, "confirm")} className="rounded-pill bg-emerald-600 px-3 py-1 font-semibold text-white">That's right</button>
                          <button onClick={() => vote(p.id, "dispute")} className="rounded-pill border border-line-strong px-3 py-1 font-semibold text-rose-600">That's wrong</button>
                        </>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New suggestion form */}
        {!isLoggedIn ? (
          <a href={`/sign-in?next=/boats/${vesselId}`} className="mt-5 block rounded-pill px-4 py-2.5 text-center text-sm font-semibold text-white" style={{ background: BOATS }}>Sign in to suggest a change</a>
        ) : (
          <div className="mt-5 space-y-3 border-t border-line pt-4">
            {target.actions.length > 1 && (
              <div className="flex gap-2">
                {target.actions.map((a) => (
                  <button key={a} onClick={() => setAction(a)} className={"rounded-pill px-3 py-1.5 text-sm font-semibold capitalize " + (action === a ? "text-white" : "border border-line-strong text-ink-soft")} style={action === a ? { background: BOATS } : undefined}>{a === "edit" ? "Change" : a}</button>
                ))}
              </div>
            )}
            {action !== "remove" && (
              <input value={value} onChange={(e) => setValue(e.target.value)} type={target.valueType === "year" || target.valueType === "number" ? "number" : "text"} placeholder={`New ${target.label.toLowerCase()}`} className="auth-input" />
            )}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="How do you know? (optional)" className="auth-input resize-none" />
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
            <button onClick={submit} disabled={busy} className="w-full rounded-pill px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BOATS }}>{busy ? "Sending…" : "Send suggestion"}</button>
            <p className="text-center text-xs text-ink-faint">3 folk agreeing applies the change automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}
