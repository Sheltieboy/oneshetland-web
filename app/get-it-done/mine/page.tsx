import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TRADE_LABEL } from "@/lib/trades";
import { MyBriefCard } from "@/components/trades/MyBriefCard";

/**
 * The jobs you've posted, and what came back.
 *
 * Closing a brief asks HOW it ended, and that question is the point: "sorted
 * through OneShetland" against "sorted elsewhere" is the only honest measure
 * of whether any of this works. Worth a little friction to get it.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Your jobs" };

export default async function MyBriefsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/get-it-done/mine");

  const sb = await createClient();
  const { data: briefs } = await sb
    .from("trade_briefs")
    .select("id, created_at, title, description, trades, scale, urgency, location_text, status, outcome")
    .eq("author_id", account.id)
    .order("created_at", { ascending: false });

  const ids = (briefs ?? []).map((b) => b.id as string);
  const { data: matches } = ids.length
    ? await sb
        .from("trade_brief_matches")
        .select("id, brief_id, business_id, status, decline_reason, responded_at, local_businesses(name, slug, phone)")
        .in("brief_id", ids)
    : { data: [] as unknown[] };

  const byBrief = new Map<string, Record<string, unknown>[]>();
  for (const m of (matches ?? []) as Record<string, unknown>[]) {
    const k = m.brief_id as string;
    byBrief.set(k, [...(byBrief.get(k) ?? []), m]);
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-4xl font-bold text-navy">Your jobs</h1>
        <Link href="/get-it-done" className="text-sm font-semibold text-teal underline">Post another</Link>
      </div>

      {(briefs ?? []).length === 0 ? (
        <p className="mt-6 text-ink-soft">
          You haven&apos;t posted anything yet.{" "}
          <Link href="/get-it-done" className="font-semibold underline">Describe a job</Link> and
          we&apos;ll show you who has room.
        </p>
      ) : (
        <div className="mt-8 space-y-5">
          {(briefs ?? []).map((b) => (
            <MyBriefCard
              key={b.id as string}
              brief={{
                id: b.id as string,
                title: b.title as string,
                trades: ((b.trades as string[]) ?? []).map((t) => TRADE_LABEL[t] ?? t),
                location: b.location_text as string,
                status: b.status as string,
                outcome: (b.outcome as string | null) ?? null,
                createdAt: b.created_at as string,
              }}
              responses={(byBrief.get(b.id as string) ?? []).map((m) => {
                const raw = m.local_businesses;
                const biz = (Array.isArray(raw) ? raw[0] : raw) as { name?: string; slug?: string; phone?: string } | null;
                return {
                  id: m.id as string,
                  status: m.status as string,
                  declineReason: (m.decline_reason as string | null) ?? null,
                  businessName: biz?.name ?? "A business",
                  businessSlug: biz?.slug ?? null,
                  // Released the other way too: once a trade says yes, the
                  // person who posted gets their number without waiting for a
                  // call. Nobody sits by the phone.
                  businessPhone: m.status === "interested" ? (biz?.phone ?? null) : null,
                };
              })}
            />
          ))}
        </div>
      )}
    </main>
  );
}
