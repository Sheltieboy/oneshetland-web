import { notFound, redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSavedEnabled } from "@/lib/saved.server";
import { readSavedList } from "@/lib/saved";
import { EMPTY, MSG, SAVED_PAGE_TITLE } from "@/lib/saved-copy";
import { SavedList } from "@/components/saved/SavedList";
import { EmptyState, JOBS } from "@/components/jobs/JobsUI";

export const dynamic = "force-dynamic";
export const metadata = { title: SAVED_PAGE_TITLE };

/**
 * My Saved: one private list of what a member has kept for later. The database builds the list (my_saved_list runs with the member's own rights, so
 * it can only show what they may read, and marks everything else "No longer available"). Signed-out visitors are sent to sign in; with the
 * feature off the page does not exist (404), so nothing about it can be found.
 */
export default async function SavedPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/saved");
  if (!(await getSavedEnabled())) notFound();

  const sb = await createClient();
  const { data, error } = await sb.rpc("my_saved_list");
  if (error?.code === "42501") redirect("/sign-in?next=/account/saved");
  const list = error ? null : readSavedList(data);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{SAVED_PAGE_TITLE}</h1>
      <p className="mt-1 text-ink-soft">Events, jobs and businesses you have kept for later.</p>
      <div className="mt-6">
        {!list ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{MSG.loadFailed}</p>
        ) : list.items.length === 0 ? (
          <EmptyState icon="🔖" title={EMPTY.title} body={EMPTY.body} cta={{ label: "See what's on", href: "/whats-on", color: JOBS }} />
        ) : (
          <SavedList initial={list} />
        )}
      </div>
    </div>
  );
}
