"use client";
/**
 * AddOnBehalf — one "Add on behalf of…" form, for a Directory listing or a Hub.
 *
 * The same component serves both kinds because the journey is identical and Phase 2 adds more of
 * them. What differs is three fields and the wording, which come from the kind.
 *
 * The duplicate step is the point of the design: the first submit asks the database whether this
 * looks like something we already have. If it does, the administrator is shown the candidates and
 * must confirm before anything is created — so a second branch of a real business is still possible,
 * but an accidental second copy is not.
 *
 * Nothing here creates an account, assigns an owner, or sends anything.
 */
import { useState } from "react";
import { BUSINESS_CATEGORIES, HUB_TYPES, type AssistedKind, type CreateResult, type DuplicateCandidate } from "@/lib/assisted/shape";

type Props = {
  kind: AssistedKind;
  submit: (form: FormData) => Promise<CreateResult>;
};

const label = "block text-sm font-semibold text-ink";
const input = "auth-input w-full";

export function AddOnBehalf({ kind, submit }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dups, setDups] = useState<DuplicateCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; path: string | null } | null>(null);

  const noun = kind === "hub" ? "Hub" : "Directory listing";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    try {
      const r = await submit(form);
      if (r.created) {
        setDone({ name: String(form.get("name") ?? ""), path: r.slug ? (kind === "hub" ? `/hubs/${r.slug}` : `/directory/${r.slug}`) : null });
        setDups(null); setOpen(false);
        (e.target as HTMLFormElement).reset();
      } else if (r.reason === "possible_duplicate") {
        setDups(r.candidates);
      } else {
        setError(r.message);
      }
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <div className="rounded-2xl border border-line-strong bg-white p-5">
        {done && (
          <p className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <strong>{done.name}</strong> has been added as an unclaimed {noun}. Nobody owns it, so OneShetland maintains it until somebody claims it.{" "}
            {done.path && <a className="font-bold underline" href={done.path}>View the public page</a>}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-ink">Add a {noun} on behalf of an organisation</h3>
            <p className="mt-1 text-sm text-ink-soft">For when somebody asks us to add them. It is created with <strong>no owner</strong> — no account, no placeholder — and they can take it over later if they want to.</p>
          </div>
          <button type="button" onClick={() => { setOpen(true); setDone(null); }} className="min-h-11 rounded-pill bg-navy px-5 text-sm font-bold text-white hover:bg-navy-dark">Add on behalf of…</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line-strong bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold text-ink">Add a {noun} on behalf of an organisation</h3>
        <button type="button" onClick={() => { setOpen(false); setDups(null); setError(null); }} className="text-sm font-bold text-navy hover:underline">Cancel</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="ab-name">Organisation name</label>
          <input id="ab-name" name="name" required maxLength={kind === "hub" ? 120 : 200} className={input} placeholder={kind === "hub" ? "e.g. Burra Youth Club" : "e.g. Hamecooked"} onChange={() => setDups(null)} />
        </div>

        {kind === "business" ? (
          <>
            <div>
              <label className={label} htmlFor="ab-category">Category</label>
              <select id="ab-category" name="category" className={input} defaultValue="other">
                {BUSINESS_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="ab-address">Address or place</label>
              <input id="ab-address" name="address" required className={input} placeholder="e.g. Tingwall" />
            </div>
            <div>
              <label className={label} htmlFor="ab-phone">Telephone <span className="font-normal text-ink-muted">(optional)</span></label>
              <input id="ab-phone" name="phone" className={input} />
            </div>
            <div>
              <label className={label} htmlFor="ab-email">Public email <span className="font-normal text-ink-muted">(optional)</span></label>
              <input id="ab-email" name="email" type="email" className={input} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className={label} htmlFor="ab-type">Kind of organisation</label>
              <select id="ab-type" name="type" className={input} defaultValue="other">
                {HUB_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="ab-area">Area <span className="font-normal text-ink-muted">(optional)</span></label>
              <input id="ab-area" name="area" className={input} placeholder="e.g. Burra" />
            </div>
            <div>
              <label className={label} htmlFor="ab-cphone">Telephone <span className="font-normal text-ink-muted">(optional)</span></label>
              <input id="ab-cphone" name="contact_phone" className={input} />
            </div>
            <div>
              <label className={label} htmlFor="ab-cemail">Public email <span className="font-normal text-ink-muted">(optional)</span></label>
              <input id="ab-cemail" name="contact_email" type="email" className={input} />
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <label className={label} htmlFor="ab-website">Website <span className="font-normal text-ink-muted">(optional)</span></label>
          <input id="ab-website" name="website" className={input} placeholder="https://" />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="ab-desc">Description <span className="font-normal text-ink-muted">(optional)</span></label>
          <textarea id="ab-desc" name="description" rows={3} className={input} />
        </div>
      </div>

      <fieldset className="rounded-xl border border-line bg-sand/40 p-4">
        <legend className="px-1 text-sm font-bold text-ink">Who asked us</legend>
        <p className="mb-3 text-sm text-ink-soft">Kept privately for our own records, and used later if you offer them management access. Never shown publicly, and never added to any mailing list.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="ab-rname">Their name <span className="font-normal text-ink-muted">(optional)</span></label>
            <input id="ab-rname" name="requested_by_name" maxLength={200} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="ab-remail">Their email <span className="font-normal text-ink-muted">(optional)</span></label>
            <input id="ab-remail" name="requested_by_email" type="email" maxLength={254} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="ab-rnote">Note <span className="font-normal text-ink-muted">(optional)</span></label>
            <input id="ab-rnote" name="request_note" maxLength={2000} className={input} placeholder="e.g. Asked by email on 20 November." />
          </div>
        </div>
      </fieldset>

      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" name="publish" defaultChecked className="mt-1 size-4" />
        <span><strong>Publish it now.</strong> Leave this unticked to add it without showing it to the public yet.</span>
      </label>

      {dups && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">We may already have {dups.length === 1 ? "this one" : "these"}.</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {dups.map((d) => (
              <li key={d.id}>
                <a className="font-semibold underline" href={kind === "hub" ? `/hubs/${d.slug ?? d.id}` : `/directory/${d.slug ?? d.id}`}>{d.name}</a>
                {" — "}{d.how}{d.claimed ? " · already claimed by its owner" : " · unclaimed"}{d.active ? "" : " · not published"}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-amber-900">If one of those is the same organisation, use it instead of adding another. If this really is a different one, confirm below.</p>
          <label className="mt-3 flex items-start gap-3 text-sm font-semibold text-amber-900">
            <input type="checkbox" name="confirm_duplicate" value="on" className="mt-1 size-4" />
            <span>I have checked — this is a different organisation. Add it anyway.</span>
          </label>
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="min-h-11 rounded-pill bg-navy px-5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
          {busy ? "Adding…" : dups ? "Add it anyway" : `Add the ${noun}`}
        </button>
        <p className="text-sm text-ink-muted">No account is created and nothing is emailed.</p>
      </div>
    </form>
  );
}
