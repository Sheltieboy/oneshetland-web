import Link from "next/link";
import { notFound } from "next/navigation";
import { getManagedActivities, getManagedActivity, type ManagedActivity } from "@/lib/activities-data";
import { SHETLAND_AREAS } from "@/lib/local-data";
import { CATEGORY_LABEL, type ActivityDraft } from "@/lib/activities";
import { ActivityForm } from "./ActivityForm";
import { ActivityEditor } from "./ActivityEditor";
import { btnPrimary, card } from "./ui";
import { ActivityImage } from "../ActivityImage";

type Kind = "business" | "hub" | "platform";
type Ctx = { kind: Kind; ownerId: string; ownerName: string; base: string; backHref: string; backLabel: string; hubVerified?: boolean };

const Shell = ({ ctx, title, children }: { ctx: Ctx; title: string; children: React.ReactNode }) => (
  <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
    <Link href={ctx.backHref} className="text-sm font-semibold text-ink-soft hover:text-ink">← {ctx.backLabel}</Link>
    <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{title}</h1>
    {children}
  </div>
);

function statusOf(a: ManagedActivity, ctx: Ctx): { label: string; cls: string } {
  if (a.admin_paused) return { label: "Paused by OneShetland", cls: "bg-rose-100 text-rose-900" };
  if (a.status === "draft") return { label: "Draft", cls: "bg-slate-200 text-slate-700" };
  if (a.status === "ended") return { label: "Ended", cls: "bg-slate-200 text-slate-700" };
  if (ctx.kind === "hub" && !a.calendar_approved && !ctx.hubVerified) return { label: "Awaiting approval", cls: "bg-amber-100 text-amber-900" };
  return { label: "Live", cls: "bg-emerald-100 text-emerald-800" };
}

export async function ActivitiesListPage({ ctx }: { ctx: Ctx }) {
  const list = await getManagedActivities(ctx.kind, ctx.ownerId);
  return (
    <Shell ctx={ctx} title="Regular activities">
      <p className="mt-2 text-ink-soft">Classes, groups and weekly sessions for {ctx.ownerName}. Free to list, whatever your plan. One listing per activity, however many days it runs, with cancellations and holiday breaks handled for you. No booking or payment set-up is needed.</p>
      <div className="mt-6"><Link href={`${ctx.base}/new`} className={btnPrimary + " inline-block"}>+ New activity</Link></div>
      {list.length === 0 ? (
        <div className={card + " mt-6 text-center"}>
          <p className="text-ink-muted">Nothing here yet. Add the first one: say what it is, pick the days and times, then publish.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((a) => {
            const st = statusOf(a, ctx);
            return (
              <li key={a.id} className={card + " flex flex-wrap items-center justify-between gap-3"}>
                {a.cover_url && <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-sand" data-manage-photo><ActivityImage url={a.cover_url} /></div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold text-ink">{a.title}</p>
                  <p className="text-sm text-ink-soft">{CATEGORY_LABEL[a.category] ?? "Activity"}{a.venue ? ` · ${a.venue}` : ""}{a.follower_count != null ? ` · ${a.follower_count} following` : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={"rounded-pill px-3 py-1 text-xs font-bold " + st.cls}>{st.label}</span>
                  <Link href={`${ctx.base}/${a.id}`} className="text-sm font-bold underline underline-offset-2">Manage</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

export function ActivityNewPage({ ctx }: { ctx: Ctx }) {
  return (
    <Shell ctx={{ ...ctx, backHref: ctx.base, backLabel: "Regular activities" }} title="New activity">
      <p className="mt-2 text-ink-soft">Start with the basics. You&apos;ll add the days and times on the next screen.</p>
      <div className="mt-6"><ActivityForm owner={{ kind: ctx.kind, id: ctx.ownerId }} base={ctx.base} areas={SHETLAND_AREAS} /></div>
    </Shell>
  );
}

export async function ActivityEditPage({ ctx, activityId }: { ctx: Ctx; activityId: string }) {
  const [d, siblings] = await Promise.all([getManagedActivity(ctx.kind, ctx.ownerId, activityId), getManagedActivities(ctx.kind, ctx.ownerId)]);
  if (!d) notFound();
  const a = d.activity;
  const draft: ActivityDraft = {
    title: a.title, description: a.description ?? "", category: a.category, audience: a.audience ?? "", venue: a.venue ?? "", locality: a.locality ?? "", price_text: a.price_text ?? "",
    booking_mode: a.booking_mode, contact_info: a.contact_info ?? "", booking_url: a.booking_url ?? "", active_from: a.active_from ?? "", active_until: a.active_until ?? "",
  };
  const pending = ctx.kind === "hub" && a.status === "published" && !a.calendar_approved && !ctx.hubVerified;
  return (
    <Shell ctx={{ ...ctx, backHref: ctx.base, backLabel: "Regular activities" }} title={a.title}>
      <div className="mt-6 space-y-5">
        <ActivityEditor
          activityId={a.id} slug={a.slug} title={a.title} status={a.status} paused={a.admin_paused} pauseReason={a.admin_pause_reason ?? null}
          hubPendingApproval={pending} followerCount={d.followerCount} base={ctx.base}
          rules={d.rules as never} sessions={d.sessions} exceptions={d.exceptions} breaks={d.breaks} siblingIds={siblings.map((s) => s.id)} defaultVenue={a.venue}
        />
        <section aria-labelledby="det-h">
          <h2 id="det-h" className="mb-3 font-display text-lg font-bold">Details</h2>
          <ActivityForm owner={{ kind: ctx.kind, id: ctx.ownerId }} base={ctx.base} activityId={a.id} initial={draft} areas={SHETLAND_AREAS} coverUrl={a.cover_url} />
        </section>
      </div>
    </Shell>
  );
}
