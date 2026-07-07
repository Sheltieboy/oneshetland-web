import Link from "next/link";
import { getEmailTemplates, getEmailLog, getEmailSettings } from "@/lib/admin-data.server";
import { AdminHeader, Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { EmailTemplates } from "@/components/admin/EmailTemplates";
import { EmailSettingsForm } from "@/components/admin/EmailSettingsForm";

export const dynamic = "force-dynamic";

const LOG_TONE: Record<string, "green" | "red" | "amber" | "gray"> = { sent: "green", delivered: "green", bounced: "red", failed: "red", skipped: "gray" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const view = tab === "log" ? "log" : tab === "settings" ? "settings" : "templates";
  const [templates, log, settings] = await Promise.all([
    view === "templates" ? getEmailTemplates() : Promise.resolve([]),
    view === "log" ? getEmailLog() : Promise.resolve([]),
    view === "settings" ? getEmailSettings() : Promise.resolve(null),
  ]);

  return (
    <>
      <AdminHeader title="Email centre" sub="Transactional and broadcast templates, footer/sender settings, and the delivery log (via Postmark)." />
      <div className="mb-5 flex gap-2">
        {[["templates", "Templates"], ["settings", "Footer & sender"], ["log", "Delivery log"]].map(([k, label]) => (
          <Link key={k} href={`/admin/email?tab=${k}`} className={"rounded-pill px-4 py-1.5 text-sm font-semibold " + (view === k ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>{label}</Link>
        ))}
      </div>

      {view === "templates" ? (
        templates.length === 0 ? <Empty>No templates found.</Empty> : <EmailTemplates rows={templates as never[]} />
      ) : view === "settings" ? (
        settings === null ? <Empty>No email settings row found.</Empty> : <EmailSettingsForm initial={settings as never} />
      ) : (
        (log as { id: string; template_key: string | null; recipient_email: string | null; status: string; error: string | null; sent_at: string }[]).length === 0 ? <Empty>No emails logged.</Empty> : (
          <div className="space-y-2">
            {(log as { id: string; template_key: string | null; recipient_email: string | null; status: string; error: string | null; sent_at: string }[]).map((e) => (
              <Card key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{e.template_key ?? "—"} <span className="font-normal text-ink-muted">→ {e.recipient_email}</span></p>
                  {e.error && <p className="text-sm text-rose-600">{e.error}</p>}
                </div>
                <div className="text-right">
                  <StatusPill label={e.status} tone={LOG_TONE[e.status] ?? "gray"} />
                  <p className="mt-1 text-xs text-ink-faint">{new Date(e.sent_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </>
  );
}
