"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTestAction } from "@/lib/launch-testing/actions";
import { formatMaxSpend } from "@/lib/launch-testing/money";
import type { LaunchTest } from "@/lib/launch-testing/types";

/** A lightweight edit form for ONE test: the things Darren needs to set (which product, which Hub, how much, wording), not a general authoring tool. */
export function TestEditor({ test }: { test: LaunchTest }) {
  const router = useRouter();
  const [f, setF] = useState({
    title: test.title, purpose: test.purpose, steps: test.steps.join("\n"), webSteps: (test.web_steps ?? []).join("\n"), expected_outcome: test.expected_outcome, priority: test.priority,
    mandatory: test.mandatory, active: test.active, platform: test.platform, sort_order: String(test.sort_order), money_test_type: test.money_test_type,
    spend: test.expected_max_spend_pence == null ? "" : (test.expected_max_spend_pence / 100).toFixed(2),
    target_url: test.target_url ?? "", target_note: test.target_note ?? "", help_text: test.help_text ?? "", effort: test.effort_minutes == null ? "" : String(test.effort_minutes),
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, run] = useTransition();

  function save() {
    setMsg(null);
    const pounds = f.spend.trim() === "" ? null : Math.round(parseFloat(f.spend) * 100);
    if (pounds !== null && (!Number.isFinite(pounds) || pounds < 0)) { setMsg({ ok: false, text: "Enter the expected spend in pounds, like 1.50." }); return; }
    run(async () => {
      const r = await updateTestAction(test.id, {
        title: f.title, purpose: f.purpose, steps: f.steps.split("\n").map((s) => s.trim()).filter(Boolean),
        web_steps: f.webSteps.split("\n").map((s) => s.trim()).filter(Boolean), expected_outcome: f.expected_outcome,
        priority: f.priority, mandatory: f.mandatory, active: f.active, platform: f.platform, sort_order: parseInt(f.sort_order, 10) || 100,
        money_test_type: f.money_test_type, expected_max_spend_pence: pounds, target_url: f.target_url.trim() || null, target_note: f.target_note.trim() || null,
        help_text: f.help_text.trim() || null, effort_minutes: f.effort.trim() ? parseInt(f.effort, 10) : null,
      });
      setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }

  const inp = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm";
  return (
    <details className="rounded-card border border-line bg-paper">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-4">
        <span className="font-bold text-ink">{test.sort_order}. {test.title}</span>
        {!test.active && <span className="rounded-pill bg-sand px-2 py-0.5 text-xs font-bold text-ink-muted">Inactive</span>}
        {test.mandatory && <span className="rounded-pill bg-navy px-2 py-0.5 text-xs font-bold text-white">Mandatory</span>}
        {test.money_test_type !== "none" && <span className="rounded-pill bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">REAL MONEY · {formatMaxSpend(test.expected_max_spend_pence) ?? "no cap set"}</span>}
      </summary>
      <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-ink sm:col-span-2">Title<input className={inp} value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
        <label className="text-sm font-semibold text-ink sm:col-span-2">Why we are testing this<textarea rows={2} className={inp} value={f.purpose} onChange={(e) => set("purpose", e.target.value)} /></label>
        <label className="text-sm font-semibold text-ink sm:col-span-2">Steps (one per line)<textarea rows={5} className={inp} value={f.steps} onChange={(e) => set("steps", e.target.value)} /></label>
        <label className="text-sm font-semibold text-ink sm:col-span-2">Website steps <span className="font-normal text-ink-muted">(one per line — shown to Website testers instead of the steps above; leave empty to reuse them)</span><textarea rows={4} className={inp} value={f.webSteps} onChange={(e) => set("webSteps", e.target.value)} /></label>
        <label className="text-sm font-semibold text-ink sm:col-span-2">What should happen<textarea rows={3} className={inp} value={f.expected_outcome} onChange={(e) => set("expected_outcome", e.target.value)} /></label>
        <label className="text-sm font-semibold text-ink sm:col-span-2">Instruction for this test <span className="font-normal text-ink-muted">(e.g. which £1.50 product to buy, or which Hub to donate to)</span>
          <input className={inp} value={f.target_note} onChange={(e) => set("target_note", e.target.value)} /></label>
        <label className="text-sm font-semibold text-ink sm:col-span-2">Link the tester can open <span className="font-normal text-ink-muted">(https only, optional)</span>
          <input className={inp} value={f.target_url} onChange={(e) => set("target_url", e.target.value)} placeholder="https://oneshetland.com/…" /></label>
        <label className="text-sm font-semibold text-ink">Money in this test
          <select className={inp} value={f.money_test_type} onChange={(e) => set("money_test_type", e.target.value as typeof f.money_test_type)}>
            <option value="none">None</option><option value="wallet">Wallet</option><option value="real_card">Real card</option><option value="donation">Donation</option></select></label>
        <label className="text-sm font-semibold text-ink">Most they should spend (£)<input className={inp} inputMode="decimal" value={f.spend} onChange={(e) => set("spend", e.target.value)} placeholder="2.00" /></label>
        <label className="text-sm font-semibold text-ink sm:col-span-2">Help / reimbursement wording <span className="font-normal text-ink-muted">(shown in the warning — only promise what you will do)</span>
          <input className={inp} value={f.help_text} onChange={(e) => set("help_text", e.target.value)} /></label>
        <label className="text-sm font-semibold text-ink">Priority<select className={inp} value={f.priority} onChange={(e) => set("priority", e.target.value as typeof f.priority)}><option value="critical">Critical</option><option value="high">High</option><option value="normal">Normal</option></select></label>
        <label className="text-sm font-semibold text-ink">Applies to<select className={inp} value={f.platform} onChange={(e) => set("platform", e.target.value as typeof f.platform)}><option value="all">All platforms (Website, iPhone, Android)</option><option value="web">Website only</option><option value="ios">iPhone only</option><option value="android">Android only</option></select></label>
        <label className="text-sm font-semibold text-ink">Order<input className={inp} inputMode="numeric" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} /></label>
        <label className="text-sm font-semibold text-ink">Minutes it takes<input className={inp} inputMode="numeric" value={f.effort} onChange={(e) => set("effort", e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" checked={f.mandatory} onChange={(e) => set("mandatory", e.target.checked)} /> Mandatory for launch</label>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active (testers can see it)</label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="button" onClick={save} disabled={pending} className="rounded-pill bg-navy px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{pending ? "Saving…" : "Save test"}</button>
          {msg && <span role="status" className={"text-sm " + (msg.ok ? "text-emerald-700" : "text-rose-700")}>{msg.text}</span>}
        </div>
      </div>
    </details>
  );
}
