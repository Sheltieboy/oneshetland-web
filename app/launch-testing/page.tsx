import { requireTester } from "./gate";
import { loadTesterHome } from "@/lib/launch-testing/data.server";
import { latestPerTest, myProgress } from "@/lib/launch-testing/readiness";
import { isPlatform } from "@/lib/launch-testing/platform";
import type { Platform } from "@/lib/launch-testing/types";
import { TesterHomeView } from "@/components/launch-testing/TesterHomeView";

export default async function LaunchTestingHome({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const ctx = await requireTester("/launch-testing");
  const { p } = await searchParams;
  const wanted: Platform | null = isPlatform(p) ? p : null;
  const home = await loadTesterHome(ctx.programme, wanted, ctx.platforms);
  const { session, tests, platform } = home;

  // Only the chosen platform's session is read, so a pass on another platform can never appear here.
  const mine = session ? home.attempts.filter((a) => a.session_id === session.id) : [];
  const latest = latestPerTest(mine);
  const progress = platform ? myProgress(tests, latest) : null;
  const first = ctx.name.split(" ")[0];

  return (
    <TesterHomeView
      programme={ctx.programme} firstName={first}
      platforms={home.byPlatform} overall={home.overall} selected={platform}
      session={session ? { build: session.app_build, device: session.device_model, browser: session.browser, deviceClass: session.device_class, viewport: session.viewport } : null}
      tests={tests.map((t) => ({ ...t, status: latest.get(t.id)?.status ?? "not_started", retest: !!latest.get(t.id)?.retest_requested }))}
      progress={progress}
    />
  );
}
