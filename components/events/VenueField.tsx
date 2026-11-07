"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Combobox, type ComboOption } from "@/components/events/Combobox";
import { textBtn } from "@/components/events/submit-ui";
import { loadBusinessVenues, loadEventVenues, normalise, suggestVenues, type LocationClient, type VenueOption } from "@/lib/event-location-search";

export const MANUAL_ID = "__manual";
const TAG: Record<VenueOption["source"], string> = { business: "Business", history: "Used for a past event" };

/**
 * The venue box: type to search OneShetland businesses and places used for past events, or just keep typing your own name.
 * What is typed is always what is saved unless a suggestion is chosen. Lookup trouble never shows an error: you simply get the plain box.
 */
export function VenueField({ id, value, selected, onTyped, onPicked, onClear, getClient, describedBy, invalid }: {
  id: string; value: string; selected: VenueOption | null;
  onTyped: (text: string) => void; onPicked: (v: VenueOption) => void; onClear: () => void;
  getClient: () => LocationClient; describedBy?: string; invalid?: boolean;
}) {
  const [history, setHistory] = useState<VenueOption[]>([]);
  const [biz, setBiz] = useState<VenueOption[]>([]);
  const loadedHistory = useRef(false);
  const seq = useRef(0);
  const input = useRef<HTMLDivElement>(null);

  // Look up (debounced) only while the box holds typed text that is not an already-chosen suggestion.
  useEffect(() => {
    const q = value.trim();
    if (selected || q.length < 2) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const sb = getClient();
        if (!loadedHistory.current) { loadedHistory.current = true; loadEventVenues(sb).then(setHistory).catch(() => {}); }
        const b = await loadBusinessVenues(sb, q);
        if (n === seq.current) setBiz(b);
      } catch { if (n === seq.current) setBiz([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [value, selected, getClient]);

  const suggestions = useMemo(() => (selected ? [] : suggestVenues(history, biz, value, 8)), [history, biz, value, selected]);   // (stale lookups are filtered by the ranking)
  const options: ComboOption[] = useMemo(() => {
    const q = value.trim();
    const list: ComboOption[] = suggestions.map((v) => ({ id: v.key, label: v.name, detail: v.context || undefined, tag: TAG[v.source] }));
    if (!selected && q.length >= 2 && !suggestions.some((v) => normalise(v.name) === normalise(q) && v.name === q)) {
      list.push({ id: MANUAL_ID, label: `Use "${q}" as a new venue name`, detail: "Not on OneShetland yet. It is sent exactly as you typed it." });
    }
    return list;
  }, [suggestions, value, selected]);

  return (
    <div ref={input}>
      <Combobox id={id} value={value} options={options} minChars={2} maxLength={220} noun="venue suggestions" describedBy={describedBy} invalid={invalid}
        onChange={onTyped}
        onSelect={(o) => { if (o.id === MANUAL_ID) return; const v = suggestions.find((s) => s.key === o.id); if (v) onPicked(v); }} />
      {selected && (
        <p className="mt-2 text-base text-ink-soft">
          Chosen from OneShetland: <span className="font-semibold text-ink">{selected.name}</span>{selected.context ? `, ${selected.context}` : ""} ({TAG[selected.source]}).{" "}
          <button type="button" className={textBtn} onClick={() => { onClear(); setTimeout(() => document.getElementById(id)?.focus(), 0); }}>Clear and change</button>
        </p>
      )}
    </div>
  );
}
