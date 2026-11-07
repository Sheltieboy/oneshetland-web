"use client";

import { useEffect, useId, useRef, useState } from "react";
import { inputCls } from "@/components/events/submit-ui";

export type ComboOption = { id: string; label: string; detail?: string; tag?: string };

/**
 * A plain accessible combobox (ARIA 1.2 editable combobox with a list popup): the text box keeps focus, Arrow keys move through the options,
 * Enter chooses, Escape closes, and a polite live region says how many suggestions there are. Options are tall enough to tap (44px+).
 * The component only shows and picks; what the options are, and what picking does, is up to the caller.
 */
export function Combobox({ id, value, onChange, onSelect, options, openOnFocus = false, minChars = 0, describedBy, invalid, maxLength, placeholder, noun = "suggestions", disabled }: {
  id: string; value: string; onChange: (text: string) => void; onSelect: (o: ComboOption) => void; options: ComboOption[];
  /** Show the list as soon as the box takes focus (a short fixed list, like the areas). */
  openOnFocus?: boolean; minChars?: number; describedBy?: string; invalid?: boolean; maxLength?: number; placeholder?: string; noun?: string; disabled?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const listId = `${id}-list-${uid}`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);
  const showable = open && options.length > 0 && value.trim().length >= minChars;
  // A new list of options starts with nothing highlighted (adjusted while rendering, not in an effect).
  const [seen, setSeen] = useState(options);
  if (seen !== options) { setSeen(options); setActive(-1); }
  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, listId]);

  const choose = (o: ComboOption) => { setOpen(false); setActive(-1); onSelect(o); };

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showable) { setOpen(true); setActive(options.length ? 0 : -1); return; }
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!showable) { setOpen(true); setActive(options.length ? options.length - 1 : -1); return; }
      setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      if (showable && active >= 0) { e.preventDefault(); choose(options[active]); }
    } else if (e.key === "Escape") {
      if (showable) { e.preventDefault(); e.stopPropagation(); setOpen(false); setActive(-1); }
    } else if (e.key === "Tab") { setOpen(false); }
  }

  return (
    <div ref={wrap} className="relative"
      onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget as Node | null)) { setOpen(false); setActive(-1); } }}>
      <input
        id={id} type="text" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={showable} aria-controls={listId}
        aria-activedescendant={showable && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined} aria-describedby={describedBy} autoComplete="off" autoCorrect="off" spellCheck={false}
        value={value} maxLength={maxLength} placeholder={placeholder} disabled={disabled}
        className={`${inputCls} ${invalid ? "border-rose-600" : ""}`}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (openOnFocus) setOpen(true); }}
        onClick={() => { if (openOnFocus) setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      <ul id={listId} role="listbox" aria-label={noun} hidden={!showable}
        className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-line-strong bg-paper shadow-lg">
        {showable && options.map((o, i) => (
          <li key={o.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o)} onMouseMove={() => setActive(i)}
            className={`flex min-h-11 cursor-pointer flex-col justify-center px-4 py-2 ${i === active ? "bg-cream outline outline-2 -outline-offset-2 outline-navy" : ""}`}>
            <span className="flex flex-wrap items-baseline gap-x-2 text-lg font-semibold text-ink">
              {o.label}
              {o.tag && <span className="text-sm font-normal text-ink-soft">{o.tag}</span>}
            </span>
            {o.detail && <span className="text-base text-ink-soft">{o.detail}</span>}
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className="sr-only">{showable ? `${options.length} ${options.length === 1 ? noun.replace(/s$/, "") : noun} available. Use the up and down arrow keys, then Enter to choose.` : ""}</p>
    </div>
  );
}
