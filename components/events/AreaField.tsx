"use client";

import { useMemo, useState } from "react";
import { Combobox, type ComboOption } from "@/components/events/Combobox";
import { textBtn } from "@/components/events/submit-ui";
import { searchAreas, type AreaIndex } from "@/lib/event-location-search";

/**
 * The area box: a searchable list of OneShetland's official areas (villages, towns and islands), also found by alternative names.
 * The saved text is the area's display name. Older typed text that matches no area is kept and shown, never silently dropped.
 */
export function AreaField({ id, index, selectedId, legacyText, onPick, onClear, describedBy, invalid }: {
  id: string; index: AreaIndex; selectedId: string | null; legacyText: string;
  onPick: (areaId: string) => void; onClear: () => void; describedBy?: string; invalid?: boolean;
}) {
  const chosen = selectedId ? index.byId.get(selectedId) ?? null : null;
  const [query, setQuery] = useState(chosen?.name ?? "");
  const [typed, setTyped] = useState(false);
  // Keep the box in step when the choice changes from outside (auto-selected from a venue, or the user cleared it).
  const [shown, setShown] = useState(chosen?.id ?? null);
  if (shown !== (chosen?.id ?? null)) { setShown(chosen?.id ?? null); setQuery(chosen?.name ?? ""); setTyped(false); }

  const options: ComboOption[] = useMemo(
    () => searchAreas(index, typed ? query : "", typed ? 12 : 80).map((a) => ({ id: a.id, label: a.name, detail: [a.context, a.alsoKnownAs ? `Also known as ${a.alsoKnownAs}` : ""].filter(Boolean).join(" · ") || undefined })),
    [index, query, typed]);

  return (
    <div onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { setQuery(chosen?.name ?? ""); setTyped(false); } }}>
      <Combobox id={id} value={query} options={options} openOnFocus maxLength={120} noun="areas" describedBy={describedBy} invalid={invalid}
        placeholder="Start typing, or choose from the list"
        onChange={(t) => { setQuery(t); setTyped(true); }}
        onSelect={(o) => { setTyped(false); setQuery(index.byId.get(o.id)?.name ?? ""); onPick(o.id); }} />
      {!chosen && legacyText && (
        <p className="mt-2 text-base text-ink-soft">Current: <span className="font-semibold text-ink">{legacyText}</span>. Choose an area above to replace it, or{" "}
          <button type="button" className={textBtn} onClick={onClear}>remove it</button>.</p>
      )}
      {chosen && (
        <p className="mt-2 text-base text-ink-soft">Chosen: <span className="font-semibold text-ink">{chosen.name}</span>{chosen.parentName && chosen.parentName !== chosen.name ? `, ${chosen.parentName}` : ""}.{" "}
          <button type="button" className={textBtn} onClick={onClear}>Clear</button></p>
      )}
    </div>
  );
}
