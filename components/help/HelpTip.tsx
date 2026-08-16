"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { HELP_TOPICS, type HelpTopicId } from "@/components/help/topics";

/**
 * HelpTip — the little "?" beside a heading.
 *
 * DESIGN RULES, because a help system gets worse the more you add to it:
 *
 * 1. A "?" only goes where the screen genuinely can't explain itself — an
 *    off-screen action, a silent failure, money, or a choice between two
 *    similar things. Putting one on every heading teaches people to ignore
 *    all of them.
 * 2. Every topic answers "what do I actually do?", not "what is this called".
 * 3. Every topic that describes a physical, two-person interaction carries a
 *    drawing, because "you show this, they type it in" is three seconds as a
 *    picture and a paragraph as words.
 *
 * The drawings are inline SVG rather than screenshots. Screenshots go stale
 * the moment the UI moves and you re-shoot them forever; a diagram of the
 * *interaction* stays true, stays sharp at any zoom, works in both themes and
 * weighs nothing.
 */
const TONE = {
  /* On cream/paper pages. */
  light:
    "border-line-strong bg-paper text-ink-muted hover:border-navy hover:bg-sand hover:text-navy focus-visible:outline-navy",
  /* On the dark counter-mode takeover. */
  dark: "border-white/30 bg-white/10 text-white/80 hover:bg-white/25 hover:text-white focus-visible:outline-white",
} as const;

export function HelpTip({
  topic,
  label,
  tone = "light",
  className = "",
}: {
  topic: HelpTopicId;
  /** Overrides the button's accessible name. Defaults to "Help with <title>". */
  label?: string;
  tone?: keyof typeof TONE;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = HELP_TOPICS[topic];
  if (!t) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label ?? `Help with ${t.title}`}
        className={`inline-grid h-6 w-6 shrink-0 place-items-center rounded-full border align-middle text-[13px] font-bold leading-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${TONE[tone]} ${className}`}
      >
        ?
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t.title}
        subtitle={t.subtitle}
        accent={t.accent}
      >
        <div className="space-y-5">
          {t.diagram}
          <div className="space-y-4">{t.body}</div>
        </div>
      </Modal>
    </>
  );
}
