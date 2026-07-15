"use client";

/**
 * MemoryPhotoPins — interactive photo with "ask the community" pin annotations,
 * mirroring the app's ImageAnnotationOverlay + the pin workflow in
 * app/memory/[id].tsx.
 *
 *   • Existing pins render as markers at their relative (x,y) coords.
 *   • The memory AUTHOR can click empty space to drop a new pin with a question.
 *   • Clicking a pin opens a panel: question, community suggestions, and —
 *     depending on viewer — a suggest box (non-author), an accept button
 *     (author), or a withdraw button (own suggestion).
 *   • Writes are gated on login; logged-out users can still read pins.
 *
 * Graceful when a photo has no pins.
 */

import { useState } from "react";
import {
  addImagePin, resolveImagePin, deleteImagePin,
  suggestImagePinAnswer, deletePinSuggestion, acceptImagePinSuggestion,
} from "@/lib/memory-pins";
import { authorName, MEMORIES, type MemoryImagePin } from "@/lib/memories-data";
import { useConfirm, useNotify } from "@/components/ui/ConfirmProvider";

export function MemoryPhotoPins({
  mediaId, url, caption, initialPins, isAuthor, isLoggedIn, userId, memoryId,
}: {
  mediaId: string; url: string; caption: string | null;
  initialPins: MemoryImagePin[];
  isAuthor: boolean; isLoggedIn: boolean; userId: string | null; memoryId: string;
}) {
  const confirm = useConfirm();
  const notify = useNotify();
  const [pins, setPins] = useState<MemoryImagePin[]>(initialPins);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const signInHref = `/sign-in?next=/memories/${memoryId}`;
  const active = activeId ? pins.find((p) => p.id === activeId) ?? null : null;

  function onImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isAuthor) return; // only the memory author can add pins
    // Ignore clicks that landed on a pin marker (they stopPropagation anyway).
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setActiveId(null);
    setPending({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
    setPrompt("");
  }

  async function submitNewPin() {
    if (!pending || !userId || !prompt.trim()) return;
    setBusy(true);
    try {
      const created = await addImagePin({ mediaId, authorId: userId, x: pending.x, y: pending.y, prompt: prompt.trim() });
      setPins((p) => [...p, { ...created, suggestions: [] }]);
      setPending(null); setPrompt("");
    } catch (err) {
      notify({ title: "Couldn't save pin", body: err instanceof Error ? err.message : "Could not save pin.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function onResolve(pin: MemoryImagePin, answer: string) {
    if (!userId || !answer.trim()) return;
    setBusy(true);
    try {
      const updated = await resolveImagePin(pin.id, answer, userId);
      setPins((ps) => ps.map((p) => p.id === pin.id ? { ...updated, suggestions: p.suggestions } : p));
      setActiveId(null);
    } catch (err) {
      notify({ title: "Couldn't save", body: err instanceof Error ? err.message : "Could not save.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function onDelete(pin: MemoryImagePin) {
    if (!(await confirm({ title: "Remove this pin?", body: "This deletes the question, not the photo.", confirmLabel: "Remove", danger: true }))) return;
    setBusy(true);
    try {
      await deleteImagePin(pin.id);
      setPins((ps) => ps.filter((p) => p.id !== pin.id));
      setActiveId(null);
    } catch (err) {
      notify({ title: "Couldn't remove", body: err instanceof Error ? err.message : "Could not remove.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function onSuggest(pin: MemoryImagePin, answer: string) {
    if (!userId || !answer.trim()) return;
    setBusy(true);
    try {
      const s = await suggestImagePinAnswer({ pinId: pin.id, suggesterId: userId, answer });
      setPins((ps) => ps.map((p) => p.id === pin.id ? { ...p, suggestions: [...(p.suggestions ?? []), s] } : p));
    } catch (err) {
      notify({ title: "Couldn't suggest", body: err instanceof Error ? err.message : "Could not suggest.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function onWithdraw(pin: MemoryImagePin, suggestionId: string) {
    setBusy(true);
    try {
      await deletePinSuggestion(suggestionId);
      setPins((ps) => ps.map((p) => p.id === pin.id ? { ...p, suggestions: (p.suggestions ?? []).filter((s) => s.id !== suggestionId) } : p));
    } catch (err) {
      notify({ title: "Couldn't withdraw", body: err instanceof Error ? err.message : "Could not withdraw.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function onAccept(pin: MemoryImagePin, suggestionId: string) {
    setBusy(true);
    try {
      const updated = await acceptImagePinSuggestion(suggestionId);
      setPins((ps) => ps.map((p) => p.id === pin.id ? {
        ...updated,
        suggestions: (p.suggestions ?? []).map((s) => ({ ...s, is_accepted: s.id === suggestionId, accepted_at: s.id === suggestionId ? new Date().toISOString() : null })),
      } : p));
      setActiveId(null);
    } catch (err) {
      notify({ title: "Couldn't accept", body: err instanceof Error ? err.message : "Could not accept.", tone: "error" });
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div
        className={"relative w-full select-none " + (isAuthor ? "cursor-crosshair" : "")}
        onClick={onImageClick}
      >
        <img src={url} alt={caption ?? ""} className="w-full object-cover" />

        {/* Existing pins */}
        {pins.map((pin) => {
          const labelRight = pin.x < 0.65;
          const nSug = pin.suggestions?.length ?? 0;
          return (
            <button
              key={pin.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); setPending(null); setActiveId((id) => id === pin.id ? null : pin.id); }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
              aria-label={pin.prompt}
            >
              <span className="relative flex items-center justify-center">
                <span
                  className="grid h-7 w-7 place-items-center rounded-full border-[2.5px] border-white text-[11px] font-bold text-white shadow-md"
                  style={{ background: pin.resolved ? "#1f9d57" : MEMORIES }}
                >
                  {pin.resolved ? "✓" : "?"}
                </span>
                {!pin.resolved && <span className="pointer-events-none absolute h-9 w-9 rounded-full border-2 border-white/60" />}
                {/* Resolved tag label */}
                {pin.resolved && pin.resolved_answer && (
                  <span
                    className={"pointer-events-none absolute top-0 max-w-[160px] truncate rounded-md bg-ink/85 px-2 py-1 text-[11px] font-bold text-white " + (labelRight ? "left-8" : "right-8")}
                  >
                    {pin.resolved_answer}
                  </span>
                )}
                {/* Suggestion-count badge on open pins */}
                {!pin.resolved && nSug > 0 && (
                  <span
                    className={"pointer-events-none absolute top-1 flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[10px] font-extrabold text-white " + (labelRight ? "left-8" : "right-8")}
                    style={{ background: MEMORIES }}
                  >
                    💡 {nSug}
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {/* Pending new-pin marker */}
        {pending && (
          <span
            className="pointer-events-none absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[2.5px] border-white text-[11px] font-bold text-white shadow-md"
            style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%`, background: MEMORIES }}
          >
            +
          </span>
        )}

        {/* Author hint when no pins yet */}
        {isAuthor && pins.length === 0 && !pending && (
          <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-pill bg-ink/80 px-3 py-1.5 text-xs font-semibold text-white">
            👆 Click the photo to ask "who is this?"
          </span>
        )}
      </div>

      {caption && <p className="px-4 py-2 text-sm text-ink-muted">{caption}</p>}

      {/* New-pin composer */}
      {pending && (
        <div className="border-t border-line bg-sand/40 p-4">
          <p className="font-display font-bold text-ink">What are you asking about?</p>
          <p className="mt-0.5 text-xs text-ink-muted">Drop a clue — "Who's the man on the left?" — and the community can answer.</p>
          <div className="mt-3 flex gap-2">
            <input
              value={prompt} onChange={(e) => setPrompt(e.target.value)} autoFocus
              placeholder="e.g. Who is this?" className="auth-input flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") submitNewPin(); }}
            />
            <button onClick={() => { setPending(null); setPrompt(""); }} className="shrink-0 rounded-pill px-3 py-2 text-sm font-semibold text-ink-muted hover:bg-sand">Cancel</button>
            <button onClick={submitNewPin} disabled={busy || !prompt.trim()} className="shrink-0 rounded-pill px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: MEMORIES }}>Add pin</button>
          </div>
        </div>
      )}

      {/* Active pin panel */}
      {active && (
        <PinPanel
          pin={active} isAuthor={isAuthor} isLoggedIn={isLoggedIn} userId={userId} busy={busy} signInHref={signInHref}
          onClose={() => setActiveId(null)}
          onResolve={(ans) => onResolve(active, ans)}
          onDelete={() => onDelete(active)}
          onSuggest={(ans) => onSuggest(active, ans)}
          onWithdraw={(sid) => onWithdraw(active, sid)}
          onAccept={(sid) => onAccept(active, sid)}
        />
      )}
    </div>
  );
}

function PinPanel({
  pin, isAuthor, isLoggedIn, userId, busy, signInHref,
  onClose, onResolve, onDelete, onSuggest, onWithdraw, onAccept,
}: {
  pin: MemoryImagePin; isAuthor: boolean; isLoggedIn: boolean; userId: string | null; busy: boolean; signInHref: string;
  onClose: () => void; onResolve: (a: string) => void; onDelete: () => void;
  onSuggest: (a: string) => void; onWithdraw: (id: string) => void; onAccept: (id: string) => void;
}) {
  const [answer, setAnswer] = useState(pin.resolved_answer ?? "");
  const [suggest, setSuggest] = useState("");
  const suggestions = pin.suggestions ?? [];
  const mine = userId ? suggestions.find((s) => s.suggester_id === userId) : null;

  return (
    <div className="border-t border-line bg-sand/40 p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: pin.resolved ? "#1f9d57" : MEMORIES }}>
          {pin.resolved ? "✓" : "?"}
        </span>
        <p className="flex-1 font-display font-bold text-ink">{pin.prompt}</p>
        <button onClick={onClose} className="shrink-0 text-ink-faint hover:text-ink" aria-label="Close">✕</button>
      </div>

      {/* Resolved answer */}
      {pin.resolved && pin.resolved_answer && (
        <p className="mt-2 rounded-card bg-emerald-50 px-3 py-2 text-sm text-ink">
          <span className="font-bold">Identified as: </span>{pin.resolved_answer}
        </p>
      )}

      {/* Community suggestions (open pins) */}
      {!pin.resolved && suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: MEMORIES }}>
            {suggestions.length === 1 ? "1 suggestion" : `${suggestions.length} suggestions`}
          </p>
          {suggestions.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-card px-3 py-2" style={{ background: `${MEMORIES}12` }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{s.answer}</p>
                <p className="text-[11px] text-ink-muted">{authorName(s.suggester)}</p>
              </div>
              {isAuthor && (
                <button onClick={() => onAccept(s.id)} disabled={busy} className="shrink-0 rounded-pill bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40">✓ Accept</button>
              )}
              {s.suggester_id === userId && (
                <button onClick={() => onWithdraw(s.id)} disabled={busy} className="shrink-0 text-ink-faint hover:text-rose-600" aria-label="Withdraw">✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Non-author + open + not yet suggested → invite a suggestion */}
      {!pin.resolved && !isAuthor && isLoggedIn && !mine && (
        <div className="mt-3">
          <p className="text-xs text-ink-muted">Recognise this? Help the author identify it — your suggestion goes to them to accept.</p>
          <div className="mt-2 flex gap-2">
            <input value={suggest} onChange={(e) => setSuggest(e.target.value)} placeholder="e.g. That's my grandfather, John Anderson" className="auth-input flex-1"
              onKeyDown={(e) => { if (e.key === "Enter" && suggest.trim()) { onSuggest(suggest.trim()); setSuggest(""); } }} />
            <button onClick={() => { if (suggest.trim()) { onSuggest(suggest.trim()); setSuggest(""); } }} disabled={busy || !suggest.trim()} className="shrink-0 rounded-pill px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: MEMORIES }}>💡 Suggest</button>
          </div>
        </div>
      )}

      {/* Non-author, already suggested */}
      {!pin.resolved && !isAuthor && mine && (
        <p className="mt-3 text-xs text-ink-muted">You've suggested "{mine.answer}". The author will see it.</p>
      )}

      {/* Logged-out invite */}
      {!pin.resolved && !isAuthor && !isLoggedIn && (
        <a href={signInHref} className="mt-3 inline-block rounded-pill px-4 py-2 text-sm font-semibold text-white" style={{ background: MEMORIES }}>Sign in to suggest an answer</a>
      )}

      {/* Author actions */}
      {isAuthor && (
        <div className="mt-3">
          {!pin.resolved && (
            <p className="text-xs text-ink-muted">{suggestions.length ? "Or type your own answer below." : "When you know the answer, type it here to tag the photo for everyone."}</p>
          )}
          <div className="mt-2 flex gap-2">
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer (e.g. 'My grandfather, John Anderson')" className="auth-input flex-1" />
            <button onClick={() => onResolve(answer.trim())} disabled={busy || !answer.trim()} className="shrink-0 rounded-pill px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: MEMORIES }}>{pin.resolved ? "Update tag" : "Tag photo"}</button>
          </div>
          <button onClick={onDelete} disabled={busy} className="mt-2 text-xs font-semibold text-rose-600 hover:underline disabled:opacity-40">Remove pin</button>
        </div>
      )}
    </div>
  );
}
