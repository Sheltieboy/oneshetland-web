"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";

type Settings = {
  id: string;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  footer_sign_off: string | null;
  footer_signature: string | null;
  footer_tagline: string | null;
  footer_promo_text: string | null;
  footer_promo_url: string | null;
  footer_legal: string | null;
};

const SENDER_FIELDS: { field: keyof Settings; label: string; placeholder: string }[] = [
  { field: "from_name", label: "From name", placeholder: "OneShetland" },
  { field: "from_email", label: "From email", placeholder: "orders@oneshetland.com" },
  { field: "reply_to", label: "Reply-to", placeholder: "hello@oneshetland.com (optional)" },
];

const FOOTER_FIELDS: { field: keyof Settings; label: string; placeholder: string }[] = [
  { field: "footer_sign_off", label: "Sign-off", placeholder: "Thanks," },
  { field: "footer_signature", label: "Signature", placeholder: "The OneShetland Team" },
  { field: "footer_tagline", label: "Tagline", placeholder: "Everything Shetland, All in One Place" },
  { field: "footer_promo_text", label: "Promo text", placeholder: "Download the app →" },
  { field: "footer_promo_url", label: "Promo URL", placeholder: "https://oneshetland.com/app" },
  { field: "footer_legal", label: "Legal line", placeholder: "OneShetland · Shetland Islands · Scotland" },
];

export function EmailSettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function setField(field: keyof Settings, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const { error } = await createClient().from("email_settings").update({
        from_name: draft.from_name,
        from_email: draft.from_email,
        reply_to: draft.reply_to,
        footer_sign_off: draft.footer_sign_off,
        footer_signature: draft.footer_signature,
        footer_tagline: draft.footer_tagline,
        footer_promo_text: draft.footer_promo_text,
        footer_promo_url: draft.footer_promo_url,
        footer_legal: draft.footer_legal,
      }).eq("id", draft.id);
      setMsg(error ? `Failed: ${error.message}` : "Saved ✓");
      if (!error) router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const fieldRow = ({ field, label, placeholder }: { field: keyof Settings; label: string; placeholder: string }) => (
    <div key={field}>
      <label className="block text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</label>
      <input
        value={(draft[field] as string | null) ?? ""}
        onChange={(e) => setField(field, e.target.value)}
        placeholder={placeholder}
        className="auth-input mt-1 text-sm"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Sender settings</h2>
        <Card>
          <p className="mb-3 text-sm text-ink-muted">Shown as the &ldquo;From&rdquo; on every email.</p>
          <div className="space-y-3">{SENDER_FIELDS.map(fieldRow)}</div>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Email footer</h2>
        <Card>
          <p className="mb-3 text-sm text-ink-muted">Appended to the bottom of every email.</p>
          <div className="space-y-3">{FOOTER_FIELDS.map(fieldRow)}</div>
        </Card>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="rounded-pill bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">{busy ? "Saving…" : "Save settings"}</button>
        {msg && <span className="text-sm font-semibold text-ink-soft">{msg}</span>}
      </div>

      <Card>
        <p className="font-semibold text-ink">Postmark</p>
        <p className="mt-1 text-sm text-ink-muted">API key is configured as a Supabase secret (<code className="font-mono">POSTMARK_API_KEY</code>). To rotate it, run <code className="font-mono">npx supabase secrets set POSTMARK_API_KEY=new-key</code>.</p>
      </Card>
    </div>
  );
}
