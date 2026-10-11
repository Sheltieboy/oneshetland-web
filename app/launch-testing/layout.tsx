import type { Metadata } from "next";

export const dynamic = "force-dynamic";
// Private by design: never indexed, never followed, never cached by a crawler. (The real protection is the database, not the address.)
export const metadata: Metadata = {
  title: "Launch Test Centre",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function LaunchTestingLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">{children}</div>;
}
