import type { Metadata } from "next";
import { DemoBanner } from "@/components/editions/DemoBanner";

export const metadata: Metadata = { title: { default: "Organiser tools", template: "%s · Organiser tools" }, robots: { index: false, follow: false } };

export default function OrganiserLayout({ children }: { children: React.ReactNode }) {
  return <><DemoBanner /><div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-5 sm:py-10">{children}</div></>;
}
