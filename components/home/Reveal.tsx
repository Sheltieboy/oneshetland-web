"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveal: content below the fold rises 14px and fades in once, as it arrives. Already-visible content is left alone, nothing hides without
 * script, and reduced motion gets no movement at all. One verb for the whole page: "rise gently".
 */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "hidden" | "shown">("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    setState("hidden");
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setState("shown"); io.disconnect(); } }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const style = state === "idle" ? undefined : {
    opacity: state === "shown" ? 1 : 0,
    transform: state === "shown" ? "none" : "translateY(14px)",
    transition: `opacity 650ms cubic-bezier(.16,1,.3,1) ${delay}ms, transform 650ms cubic-bezier(.16,1,.3,1) ${delay}ms`,
  };
  return <div ref={ref} className={className} style={style}>{children}</div>;
}
