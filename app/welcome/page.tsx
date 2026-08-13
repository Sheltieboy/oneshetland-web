import { redirect } from "next/navigation";
import { getOnboardingState } from "@/lib/onboarding.server";
import { JoinWizard } from "@/components/welcome/JoinWizard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Welcome",
  description: "Get set up on OneShetland.",
  // Personal setup flow — never index it.
  robots: { index: false, follow: false },
};

export default async function WelcomePage() {
  const state = await getOnboardingState();
  if (!state) redirect("/sign-in?next=/welcome");
  return <JoinWizard state={state} />;
}
