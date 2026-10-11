"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/launch-testing", label: "Results" },
  { href: "/admin/launch-testing/testers", label: "Testers" },
  { href: "/admin/launch-testing/tests", label: "Tests" },
];

export function AdminTabs({ programme }: { programme?: string | null }) {
  const path = usePathname();
  const q = programme ? `?programme=${encodeURIComponent(programme)}` : "";
  return (
    <nav aria-label="Launch testing" className="mb-6 flex gap-1 border-b border-line">
      {TABS.map((t) => {
        const active = t.href === "/admin/launch-testing" ? path === t.href : path.startsWith(t.href);
        return <Link key={t.href} href={`${t.href}${q}`} aria-current={active ? "page" : undefined}
          className={"-mb-px border-b-2 px-4 py-2 text-sm font-bold " + (active ? "border-navy text-ink" : "border-transparent text-ink-muted hover:text-ink")}>{t.label}</Link>;
      })}
    </nav>
  );
}
