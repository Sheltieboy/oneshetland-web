import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTester } from "../gate";
import { loadTestPage } from "@/lib/launch-testing/data.server";
import type { Platform } from "@/lib/launch-testing/types";
import { TestFlow } from "@/components/launch-testing/TestFlow";

export default async function LaunchTestPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ p?: string }> }) {
  const { slug } = await params;
  const { p } = await searchParams;
  const ctx = await requireTester(`/launch-testing/${slug}`);
  const wanted: Platform | null = p === "ios" || p === "android" ? p : null;
  const page = await loadTestPage(ctx.programme, slug, wanted);
  if (!page) notFound();
  const { test, session, current, previous, attachments, number } = page;

  return (
    <div className="space-y-5">
      <Link href={`/launch-testing?p=${session.platform}`} className="inline-block text-sm font-semibold text-ink-soft hover:underline">← All tests</Link>
      <TestFlow
        number={number}
        platform={session.platform}
        sessionId={session.id}
        test={{
          id: test.id, category: test.category, title: test.title, purpose: test.purpose, steps: test.steps, expected_outcome: test.expected_outcome,
          mandatory: test.mandatory, money_test_type: test.money_test_type, expected_max_spend_pence: test.expected_max_spend_pence,
          target_url: test.target_url, target_note: test.target_note, help_text: test.help_text, effort_minutes: test.effort_minutes,
        }}
        current={current ? { id: current.id } : null}
        last={previous ? {
          id: previous.id, status: previous.status as "passed" | "issue" | "blocked", tester_note: previous.tester_note, issue_description: previous.issue_description,
          retest_requested: previous.retest_requested, review_state: previous.review_state, admin_note: previous.admin_note, completed_at: previous.completed_at,
        } : null}
        attachments={attachments.map((a) => ({ id: a.id, url: a.url }))}
      />
    </div>
  );
}
