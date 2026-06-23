import type { HubType } from "@/lib/hubs-data";

/** Monochrome line icons per hub type (stroke = currentColor), matching the
 *  app's badge icons. Fall back to a generic "group" glyph. */
export function HubTypeIcon({ type, className }: { type: HubType; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
  switch (type) {
    case "youth":
      return (
        <svg {...common}><circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" /></svg>
      );
    case "sports":
      return (
        <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m12 7 4.5 3.3-1.7 5.2H9.2L7.5 10.3 12 7Z" /></svg>
      );
    case "hall":
      return (
        <svg {...common}><path d="M3 21h18" /><path d="m12 3 8 5H4l8-5Z" /><path d="M6 10v8M10 10v8M14 10v8M18 10v8" /></svg>
      );
    case "charity":
      return (
        <svg {...common}><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 12 5 5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7 7-7Z" /></svg>
      );
    case "volunteer":
      return (
        <svg {...common}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></svg>
      );
    case "arts":
      return (
        <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="8.5" cy="9" r="1" /><circle cx="15.5" cy="9" r="1" /><circle cx="9" cy="15" r="1" /><circle cx="15" cy="15" r="1" /></svg>
      );
    case "community":
      return (
        <svg {...common}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>
      );
    case "club":
      return (
        <svg {...common}><path d="m12 2 3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1L12 2Z" /></svg>
      );
    default: // society, other → group
      return (
        <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 6a3 3 0 0 1 0 5.5" /><path d="M17 14.5a5.5 5.5 0 0 1 3.5 5" /></svg>
      );
  }
}
