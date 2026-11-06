import type { Metadata } from "next";
import { fetchIsOpen } from "@/lib/fetch-paused";
import { FetchPaused } from "@/components/fetch/FetchPaused";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fetch · Being prepared for launch" };

/**
 * Every /fetch route sits behind the database switch. While Fetch is paused (the default, and the answer to any error) NO Fetch page renders: not the
 * request form, the driver application, the dashboard nor a request's detail. The database refuses the underlying writes independently.
 */
export default async function FetchLayout({ children }: { children: React.ReactNode }) {
  if (!(await fetchIsOpen())) return <FetchPaused />;
  return <>{children}</>;
}
