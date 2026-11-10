"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/** Section links, set as quiet small capitals with an underline for the current one. Scrolls sideways inside its own row on a phone (the page never does). Actions (save, calendar) sit on the same row. */
export function EditionNav({ items, actions }: { items: NavItem[]; actions?: ReactNode }) {
  const path = (usePathname() ?? "").replace(/\/+$/, "");
  const list = useRef<HTMLUListElement>(null);
  // On a phone the row scrolls sideways: bring the current section into view so the visitor always sees where they are (scrolls only this row, never the page)
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && list.current && list.current.scrollWidth > list.current.clientWidth) list.current.scrollTo({ left: Math.max(0, el.offsetLeft - 24), behavior: "auto" });
  }, [path]);
  if (items.length < 2 && !actions) return null;
  return (
    <div className="ed-nav">
      <div className="ed-wrap ed-nav__in">
        {items.length >= 2 && (
          <nav aria-label="Edition sections">
            <ul className="ed-nav__list" ref={list}>
              {items.map((it) => (
                <li key={it.href}>
                  <Link href={it.href} aria-current={path === it.href ? "page" : undefined} className="ed-nav__link">{it.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {actions && <div className="ed-nav__actions">{actions}</div>}
      </div>
    </div>
  );
}
