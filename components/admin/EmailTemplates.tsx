"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, StatusPill } from "@/components/admin/AdminUI";

type Row = { id: string; key: string; category: string | null; label: string | null; description: string | null; enabled: boolean; subject: string | null; body_html: string | null; postmark_stream: string | null };

export function EmailTemplates({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body_html: string }>({ subject: "", body_html: "" });
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sb = () => createClient();

  async function toggle(r: Row) {
    await sb().from("email_templates").update({ enabled: !r.enabled }).eq("id", r.id);
    setList((l) => l.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)));
    router.refresh();
  }
  function openEdit(r: Row) { setOpenId(r.id); setDraft({ subject: r.subject ?? "", body_html: r.body_html ?? "" }); setMsg(null); }
  async function saveEdit(r: Row) {
    setBusy(true);
    try {
      await sb().from("email_templates").update({ subject: draft.subject, body_html: draft.body_html }).eq("id", r.id);
      setList((l) => l.map((x) => (x.id === r.id ? { ...x, ...draft } : x)));
      setOpenId(null); router.refresh();
    } finally { setBusy(false); }
  }
  async function sendTest(r: Row) {
    if (!testTo.trim()) { setMsg("Enter a test email address."); return; }
    setBusy(true); setMsg(null);
    try {
      const { error } = await sb().functions.invoke("send-email", { body: { template_key: r.key, recipient_email: testTo.trim(), metadata: { test: true } } });
      setMsg(error ? `Failed: ${error.message}` : "Test email sent ✓");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Failed to send test."); } finally { setBusy(false); }
  }

  const groups = [...new Set(list.map((r) => r.category ?? "Other"))];
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-3 font-display text-lg font-bold capitalize text-ink">{g}</h2>
          <div className="space-y-3">
            {list.filter((r) => (r.category ?? "Other") === g).map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-ink">{r.label ?? r.key} {r.postmark_stream && <StatusPill label={r.postmark_stream} tone="blue" />}</p>
                    {r.description && <p className="text-sm text-ink-muted">{r.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggle(r)} className={"rounded-pill px-3 py-1.5 text-xs font-bold " + (r.enabled ? "bg-emerald-100 text-emerald-700" : "bg-sand text-ink-muted")}>{r.enabled ? "Enabled" : "Disabled"}</button>
                    <button onClick={() => (openId === r.id ? setOpenId(null) : openEdit(r))} className="rounded-pill border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sand">{openId === r.id ? "Close" : "Edit"}</button>
                  </div>
                </div>
                {openId === r.id && (
                  <div className="mt-3 space-y-2 border-t border-line pt-3">
                    <input value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} placeholder="Subject" className="auth-input text-sm" />
                    <textarea value={draft.body_html} onChange={(e) => setDraft((d) => ({ ...d, body_html: e.target.value }))} rows={8} placeholder="Body HTML" className="auth-input resize-y font-mono text-xs" />
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => saveEdit(r)} disabled={busy} className="rounded-pill bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">Save</button>
                      <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="test@email" className="auth-input w-48 text-sm" />
                      <button onClick={() => sendTest(r)} disabled={busy} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-40">Send test</button>
                      {msg && <span className="text-sm font-semibold text-ink-soft">{msg}</span>}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
