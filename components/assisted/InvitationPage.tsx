"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { requestOwnership, declineOwnership, type ClaimResult, type DeclineResult } from "@/app/claim/[slug]/actions";
import { whatYouCouldManage, type ClaimState, type InviteOpen } from "@/lib/assisted/invites";

/**
 * The invitation, as the organisation sees it. Mobile first: one column, generous tap targets, and no
 * step that needs a wide screen.
 *
 * The order of the page is the argument it is making:
 *   1. here is the page we made, and it is already live — nothing is being held hostage;
 *   2. taking it over is optional and free;
 *   3. this is what you would be able to do;
 *   4. two equal choices — take it on, or leave it with us.
 */

const card = "rounded-[1.5rem] border border-line bg-white p-5 shadow-soft sm:p-8";
const input = "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink outline-none focus:border-teal";
const primary = "inline-flex min-h-12 items-center justify-center rounded-pill bg-navy px-6 py-3 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60";
const secondary = "inline-flex min-h-12 items-center justify-center rounded-pill border border-line-strong px-6 py-3 text-sm font-bold text-ink-soft hover:bg-sand disabled:opacity-60";

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-5 sm:py-14">{children}</main>;
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h1 className="font-display text-2xl font-bold leading-tight text-ink sm:text-4xl">{children}</h1>;
}

export function InvitationPage({ slug, view, state, signedIn, signInHref, email, defaultName, defaultPhone, managePath }: {
  slug: string;
  view: InviteOpen;
  /** Null when nobody is signed in: the claim state is only knowable for an account. */
  state: ClaimState | null;
  signedIn: boolean;
  signInHref: string;
  email: string | null;
  defaultName: string;
  defaultPhone: string;
  /** Where the owner manages it, once they are the owner. */
  managePath: string | null;
}) {
  const [result, submit, pending] = useActionState<ClaimResult | null, FormData>(requestOwnership.bind(null, slug), null);
  const [declined, decline, declining] = useActionState<DeclineResult | null, FormData>(declineOwnership.bind(null, slug), null);
  const [showForm, setShowForm] = useState(false);
  const [showDecline, setShowDecline] = useState(false);

  const kind = view.kind;
  const noun = kind === "hub" ? "page" : "listing";
  const name = view.subject.name;
  const effective: ClaimState | null = result?.ok ? result.state : state;

  /* ── the states that are not "you could have this" ─────────────────────── */

  if (declined?.ok) {
    return (
      <Shell>
        <section className={card}>
          <Heading>That is no bother at all</Heading>
          <div className="mt-4 space-y-3 text-ink-soft">
            <p>We have noted that you would rather not take it on, and we will not ask again.</p>
            <p>
              The {noun} for <strong className="text-ink">{name}</strong> stays exactly as it is, and we will keep looking
              after it. If anything on it is wrong or out of date,{" "}
              <Link href="/support" className="font-semibold text-ink underline underline-offset-2">tell us</Link> and we
              will change it — or take it down altogether if you would rather.
            </p>
            <p className="pt-2">
              <Link href={view.subject.path} className="font-semibold text-ink underline underline-offset-2">See the {noun} →</Link>
            </p>
          </div>
        </section>
      </Shell>
    );
  }

  if (effective === "pending") {
    return (
      <Shell>
        <section className={card}>
          <Heading>Thank you — we have your request</Heading>
          <div className="mt-4 space-y-3 text-ink-soft">
            <p>
              Before handing <strong className="text-ink">{name}</strong> over, we check that you are connected to it. That
              is a person reading your answers, not an automatic step, so it may take a day or two.
            </p>
            <p>Nothing has changed on the {noun} in the meantime, and you do not need to do anything else.</p>
            <p className="pt-2">
              <Link href={view.subject.path} className="font-semibold text-ink underline underline-offset-2">See the {noun} →</Link>
            </p>
          </div>
        </section>
      </Shell>
    );
  }

  if (effective === "owner") {
    return (
      <Shell>
        <section className={card}>
          <Heading>{name} is yours to manage</Heading>
          <div className="mt-4 space-y-3 text-ink-soft">
            <p>It is the same {noun} people have been finding all along — nothing was republished or started again.</p>
            <div className="flex flex-wrap gap-3 pt-2">
              {managePath && <Link href={managePath} className={primary}>Manage {name} →</Link>}
              <Link href={view.subject.path} className={secondary}>See the public {noun}</Link>
            </div>
          </div>
        </section>
      </Shell>
    );
  }

  // Deliberately the same plain words for both: neither says who else asked, or that anybody did.
  if (effective === "claimed_by_other" || effective === "invite_used") {
    return (
      <Shell>
        <section className={card}>
          <Heading>We cannot hand this one over from here</Heading>
          <div className="mt-4 space-y-3 text-ink-soft">
            <p>Somebody else is already dealing with <strong className="text-ink">{name}</strong>.</p>
            <p>
              If that is not right,{" "}
              <Link href="/support" className="font-semibold text-ink underline underline-offset-2">get in touch</Link> and we
              will sort it out with you.
            </p>
          </div>
        </section>
      </Shell>
    );
  }

  if (effective === "rejected") {
    return (
      <Shell>
        <section className={card}>
          <Heading>We could not confirm the connection</Heading>
          <div className="mt-4 space-y-3 text-ink-soft">
            <p>
              We were not able to confirm that you are authorised to act for <strong className="text-ink">{name}</strong>,
              so we have not handed the {noun} over.
            </p>
            <p>
              The {noun} is unchanged and we are still looking after it. If we have got this wrong,{" "}
              <Link href="/support" className="font-semibold text-ink underline underline-offset-2">tell us</Link> — we would
              rather fix it than leave it.
            </p>
          </div>
        </section>
      </Shell>
    );
  }

  /* ── the invitation itself ─────────────────────────────────────────────── */

  return (
    <Shell>
      <div className="space-y-5">
        <section className={card}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">An invitation from OneShetland</p>
          <div className="mt-2">
            <Heading>{name} is already on OneShetland</Heading>
          </div>
          <div className="mt-4 space-y-3 text-ink-soft">
            <p>
              We added a {noun} for {name} so that people looking for you can find you. It is live now, and it was written
              from information that is already publicly available.
            </p>
            {view.subject.description && (
              <blockquote className="rounded-xl border-l-4 border-line-strong bg-sand px-4 py-3 text-ink">
                {view.subject.description}
              </blockquote>
            )}
            <p>
              <Link href={view.subject.path} className="font-semibold text-ink underline underline-offset-2">
                See the {noun} as everyone else sees it →
              </Link>
              {view.subject.area ? <span className="text-ink-soft"> · {view.subject.area}</span> : null}
            </p>
            <p className="rounded-xl bg-sand px-4 py-3 text-sm">
              <strong className="text-ink">You do not have to do anything.</strong> Taking it over is optional and free, and
              if you would rather we kept looking after it, that is genuinely fine.
            </p>
          </div>
        </section>

        <section className={card}>
          <h2 className="font-display text-xl font-bold text-ink">If you look after it yourself</h2>
          <ul className="mt-3 space-y-2 text-ink-soft">
            {whatYouCouldManage(kind).map((l) => (
              <li key={l} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-hubs" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-soft">
            There is no charge for any of that, and nothing is switched on without you choosing it.
          </p>
        </section>

        {!signedIn ? (
          <section className={card}>
            <h2 className="font-display text-xl font-bold text-ink">Would you like to look after it?</h2>
            <p className="mt-3 text-ink-soft">
              You would need a OneShetland account — it is free, and takes a minute. We then check that you are connected
              to {name} before handing anything over, so the link on its own is not enough.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href={signInHref} className={primary}>Yes — sign in or create an account</Link>
              <button type="button" onClick={() => setShowDecline((v) => !v)} className={secondary}>No thanks</button>
            </div>
            {showDecline && (
              <form action={decline} className="mt-5 border-t border-line pt-5">
                <label className="block text-sm font-semibold text-ink" htmlFor="reason">
                  Anything you would like to say? <span className="font-normal text-ink-soft">(optional)</span>
                </label>
                <textarea id="reason" name="reason" rows={3} maxLength={500} className={input}
                  placeholder="e.g. We are happy as we are, but the phone number is wrong." />
                <p className="mt-2 text-sm text-ink-soft">
                  The {noun} stays exactly as it is either way. We will not ask you again.
                </p>
                <button type="submit" disabled={declining} className={`${secondary} mt-3`}>
                  {declining ? "Sending…" : "Send that, and leave it with OneShetland"}
                </button>
                {declined && !declined.ok && <p className="mt-3 text-sm font-semibold text-rose-900">{declined.error}</p>}
              </form>
            )}
          </section>
        ) : !showForm ? (
          <section className={card}>
            <h2 className="font-display text-xl font-bold text-ink">Would you like to look after it?</h2>
            <p className="mt-3 text-ink-soft">
              Tell us who you are and how you are connected to {name}. We read every one of these ourselves.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => setShowForm(true)} className={primary}>Yes — ask to look after it</button>
              <button type="button" onClick={() => setShowDecline((v) => !v)} className={secondary}>No thanks</button>
            </div>
            {showDecline && (
              <form action={decline} className="mt-5 border-t border-line pt-5">
                <label className="block text-sm font-semibold text-ink" htmlFor="reason2">
                  Anything you would like to say? <span className="font-normal text-ink-soft">(optional)</span>
                </label>
                <textarea id="reason2" name="reason" rows={3} maxLength={500} className={input} />
                <p className="mt-2 text-sm text-ink-soft">The {noun} stays exactly as it is either way.</p>
                <button type="submit" disabled={declining} className={`${secondary} mt-3`}>
                  {declining ? "Sending…" : "Send that, and leave it with OneShetland"}
                </button>
                {declined && !declined.ok && <p className="mt-3 text-sm font-semibold text-rose-900">{declined.error}</p>}
              </form>
            )}
          </section>
        ) : (
          <section className={card}>
            <h2 className="font-display text-xl font-bold text-ink">Ask to look after {name}</h2>
            <form action={submit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink" htmlFor="name">Your name</label>
                <input id="name" name="name" required maxLength={200} defaultValue={defaultName} className={input} autoComplete="name" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink" htmlFor="email">Your email</label>
                <input id="email" name="email" type="email" required maxLength={254} defaultValue={email ?? ""} className={input} autoComplete="email" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink" htmlFor="phone">
                  Telephone <span className="font-normal text-ink-soft">(optional)</span>
                </label>
                <input id="phone" name="phone" maxLength={50} defaultValue={defaultPhone} className={input} autoComplete="tel" inputMode="tel" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink" htmlFor="role">
                  What you do there <span className="font-normal text-ink-soft">(optional)</span>
                </label>
                <input id="role" name="role" maxLength={100} className={input}
                  placeholder={kind === "hub" ? "e.g. Secretary" : "e.g. Owner"} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink" htmlFor="evidence">
                  How can we check? <span className="font-normal text-ink-soft">(optional, but it speeds things up)</span>
                </label>
                <textarea id="evidence" name="evidence" rows={4} maxLength={2000} className={input}
                  placeholder="Anything that helps — your work email address, a page that lists you, or just say to ring the number on the page." />
              </div>
              <label className="flex items-start gap-3 rounded-xl bg-sand px-4 py-3">
                <input type="checkbox" name="confirm" className="mt-1 h-5 w-5 shrink-0" />
                <span className="text-sm text-ink-soft">
                  I help run {name}, or I am authorised to act for it.
                </span>
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" disabled={pending} className={primary}>{pending ? "Sending…" : "Send my request"}</button>
                <button type="button" onClick={() => setShowForm(false)} className={secondary}>Back</button>
              </div>
              {result && !result.ok && <p className="text-sm font-semibold text-rose-900">{result.error}</p>}
              <p className="text-sm text-ink-soft">
                Sending this does not change the {noun} and does not give you access yet. We confirm the connection first.
              </p>
            </form>
          </section>
        )}
      </div>
    </Shell>
  );
}
