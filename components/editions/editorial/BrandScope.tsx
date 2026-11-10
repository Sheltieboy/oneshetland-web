import type { CSSProperties, ReactNode } from "react";
import type { Brand } from "@/lib/editions/brand";
import { EDITION_FONT_VARS } from "@/lib/editions/fonts";
import "./editorial.css";

/**
 * The brand scope: everything inside it is drawn by the editorial design system in the organiser's colours (one shared typeface, square edges and layout for every Edition). The scope sets only CSS custom
 * properties (from lib/editions/brand.ts), so there is no per-organiser CSS and nothing an organiser can type that reaches a stylesheet: the values are
 * derived hex colours, never raw input.
 */
export function BrandScope({ brand, children, className = "" }: { brand: Brand; children: ReactNode; className?: string }) {
  return (
    <div className={`ed ${EDITION_FONT_VARS} ${className}`.trim()} style={brand.vars as CSSProperties}>
      {children}
    </div>
  );
}
