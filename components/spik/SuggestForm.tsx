"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SUGGEST_FIELDS, SPIK_COLOR, type SuggestField } from "@/lib/spik-data";

type CurrentValues = Record<string, string>;

export function SuggestForm({
  wordId,
  word,
  current,
  onClose,
}: {
  wordId: number;
  word: string;
  current: CurrentValues;
  onClose?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(SUGGEST_FIELDS[0].name);
  const [submitterName, setSubmitterName] = useState("");
  const [showName, setShowName] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  const filled = SUGGEST_FIELDS.filter((f) => (values[f.name] ?? "").trim().length > 0);
  const count = filled.length;

  const set = (name: string, val: string) =>
    setValues((p) => ({ ...p, [name]: val }));

  async function submit() {
    if (count === 0) return;
    setStatus("saving");
    const rows = filled.map((f) => ({
      word_id: wordId,
      word,
      field_name: f.name,
      field_label: f.label,
      current_value: current[f.name] || null,
      suggested_value: values[f.name].trim(),
      submitter_name: submitterName.trim() || null,
      show_name: showName,
      status: "pending",
    }));
    try {
      const sb = createClient();
      const { error } = await sb.from("spik_suggestions").insert(rows);
      if (error) throw error;
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-line bg-paper p-8 text-center shadow-soft sm:p-12">
        <span
          className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper"
          style={{ background: SPIK_COLOR }}
          aria-hidden
        >
          ✓
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold">Thank you!</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">
          Your suggestion{count > 1 ? "s have" : " has"} been sent for review.{" "}
          {showName && submitterName.trim()
            ? `If approved, “${submitterName.trim()}” will appear as a contributor on “${word}”.`
            : `Once reviewed, any approved changes will appear on “${word}”.`}
        </p>
        <button
          onClick={onClose}
          className="mt-6 inline-block rounded-pill px-5 py-3 font-semibold text-paper"
          style={{ background: SPIK_COLOR }}
        >
          Back to word
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {SUGGEST_FIELDS.map((f) => (
        <FieldRow
          key={f.name}
          field={f}
          current={current[f.name] || ""}
          value={values[f.name] ?? ""}
          isOpen={open === f.name}
          onToggle={() => setOpen(open === f.name ? null : f.name)}
          onChange={(v) => set(f.name, v)}
        />
      ))}

      {/* Attribution */}
      <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h3 className="font-display text-lg font-bold">Your name</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Shetland dialect is a community project. Let folk know you helped.
        </p>
        <input
          value={submitterName}
          onChange={(e) => setSubmitterName(e.target.value)}
          placeholder="Your name (optional)"
          className="mt-3 w-full rounded-lg border border-line bg-cream/40 px-4 py-2.5 text-ink outline-none focus:border-spik"
        />
        <label className="mt-3 flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold text-ink">Show my name on this word</span>
            <span className="block text-xs text-ink-muted">
              {showName ? "Your name appears as a contributor" : "Your contribution stays anonymous"}
            </span>
          </span>
          <input
            type="checkbox"
            checked={showName}
            onChange={(e) => setShowName(e.target.checked)}
            className="h-5 w-5 accent-spik"
          />
        </label>
      </div>

      {status === "error" && (
        <p className="text-center text-sm font-semibold text-rose-600">
          Something went wrong — please try again in a moment.
        </p>
      )}

      <button
        onClick={submit}
        disabled={count === 0 || status === "saving"}
        className="w-full rounded-pill px-5 py-3.5 font-semibold text-paper shadow-soft transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: SPIK_COLOR }}
      >
        {status === "saving"
          ? "Sending…"
          : count > 0
            ? `Send ${count} suggestion${count > 1 ? "s" : ""} for review`
            : "Open a field above to get started"}
      </button>

      <p className="px-4 text-center text-xs leading-relaxed text-ink-muted">
        Community suggestions help keep Spik accurate and alive. Shetland dialect
        belongs to everyone — help us get it right.
      </p>
    </div>
  );
}

function FieldRow({
  field,
  current,
  value,
  isOpen,
  onToggle,
  onChange,
}: {
  field: SuggestField;
  current: string;
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
}) {
  const has = value.trim().length > 0;
  return (
    <div className={"overflow-hidden rounded-xl border bg-paper shadow-soft " + (has ? "border-spik" : "border-line")}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2">
          {has && <span className="h-2 w-2 rounded-full" style={{ background: SPIK_COLOR }} />}
          <span className={"font-semibold " + (has ? "text-spik" : "text-ink")}>{field.label}</span>
          {has && field.type === "select" && (
            <span className="rounded-pill px-2 py-0.5 text-xs font-semibold capitalize" style={{ background: `${SPIK_COLOR}22`, color: SPIK_COLOR }}>
              {value}
            </span>
          )}
        </span>
        <span aria-hidden className="text-ink-faint">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="space-y-3 px-5 pb-5">
          {current && (
            <div className="rounded-lg bg-cream/60 p-3">
              <p className="eyebrow text-ink-faint">Current</p>
              <p className="mt-0.5 text-sm text-ink-soft">{current}</p>
            </div>
          )}
          <p className="text-xs text-ink-muted">{field.hint}</p>

          {field.type === "select" ? (
            <div className="flex flex-wrap gap-2">
              {field.options!.map((opt) => {
                const active = value === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(active ? "" : opt)}
                    className={
                      "rounded-pill border px-3 py-1.5 text-sm font-semibold capitalize transition " +
                      (active ? "text-paper" : "border-line bg-cream/40 text-ink-soft hover:border-spik")
                    }
                    style={active ? { background: SPIK_COLOR, borderColor: SPIK_COLOR } : undefined}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : field.type === "multiline" ? (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={4}
              placeholder="Your suggestion…"
              className="w-full rounded-lg border border-line bg-cream/40 px-4 py-2.5 text-ink outline-none focus:border-spik"
            />
          ) : (
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Your suggestion…"
              className="w-full rounded-lg border border-line bg-cream/40 px-4 py-2.5 text-ink outline-none focus:border-spik"
            />
          )}
        </div>
      )}
    </div>
  );
}
