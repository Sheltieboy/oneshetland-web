"use client";

/**
 * AiGlow — wraps any area Peerie Bot is acting on. While `active`, the border
 * lights up with a multicoloured wave that flows around the edge using the
 * OneShetland ring colours (see globals.css `.ai-glow`). Inert (no visual
 * change) when `active` is false, so it's safe to leave mounted around a form.
 */
export function AiGlow({
  active,
  children,
  className = "",
  radius,
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
  /** Optional border-radius override to match the wrapped element. */
  radius?: number | string;
}) {
  return (
    <div
      className={`ai-glow${active ? " is-active" : ""} ${className}`}
      style={radius != null ? { borderRadius: typeof radius === "number" ? `${radius}px` : radius } : undefined}
      aria-busy={active || undefined}
    >
      {children}
    </div>
  );
}
