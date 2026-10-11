import { requireTester } from "./gate";
import { loadTesterHome } from "@/lib/launch-testing/data.server";
import { latestPerTest, myProgress } from "@/lib/launch-testing/readiness";
import type { Platform } from "@/lib/launch-testing/types";
import { TesterHomeView } from "@/components/launch-testing/TesterHomeView";

export default async function LaunchTestingHome({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const ctx = await requireTester("/launch-testing");
  const { p } = await searchParams;
  const wanted: Platform | null = p === "ios" || p === "android" ? p : null;
  const home = await loadTesterHome(ctx.programme, wanted);
  const { session, tests } = home;

  const mine = session ? home.attempts.filter((a) => a.session_id === session.id) : [];
  const latest = latestPerTest(mine);
  const progress = myProgress(tests, latest);
  const first = ctx.name.split(" ")[0];

  return (
    <TesterHomeView
      programme={ctx.programme} firstName={first} allowed={ctx.platforms}
      sessions={home.sessions.map((s) => ({ platform: s.platform, build: s.app_build, device: s.device_model }))}
      session={session ? { platform: session.platform, build: session.app_build } : null}
      tests={tests.map((t) => ({ ...t, status: latest.get(t.id)?.status ?? "not_started", retest: !!latest.get(t.id)?.retest_requested }))}
      progress={progress}
    />
  );
}
