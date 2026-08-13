"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CardSetup } from "@/components/payments/CardSetup";
import { ConnectPayoutsButton } from "@/components/payments/ConnectPayoutsButton";
import { SoftLaunchNotice } from "@/components/site/SoftLaunchNotice";
import { BusinessClaimSearch } from "@/components/welcome/BusinessClaimSearch";
import { AUDIENCE_COOKIE, type Audience } from "@/lib/audience";
import {
  AREAS,
  HANDLE_HINT,
  HANDLE_PATTERN,
  firstIncomplete,
  steps,
  type OnboardingState,
  type StepId,
} from "@/lib/onboarding";

const NAVY = "#032f4c";

/**
 * The join wizard.
 *
 * Two rules shape the whole thing:
 *
 * 1. NOTHING HERE IS COMPULSORY EXCEPT A NAME. Every money step is optional and
 *    says so out loud, because the fastest way to lose someone on a soft launch
 *    is to make it look like they must hand over a card to join a community
 *    site. "Skip" is a real button, not a link hidden in grey.
 *
 * 2. IT REUSES THE REAL SCREENS' COMPONENTS. Card and payout setup are the very
 *    same <CardSetup> and <ConnectPayoutsButton> used on /account/payments, so
 *    there is exactly one Stripe integration to test, and the wizard can never
 *    drift out of step with the page it mirrors.
 */
export function JoinWizard({ state }: { state: OnboardingState }) {
  const router = useRouter();
  const list = useMemo(() => steps(state), [state]);
  const [step, setStep] = useState<StepId>(() => firstIncomplete(state));
  const [finished, setFinished] = useState(false);

  const index = list.findIndex((s) => s.id === step);
  const isLast = index === list.length - 1;

  function next() {
    if (isLast) return setFinished(true);
    setStep(list[index + 1].id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function back() {
    if (index <= 0) return;
    setStep(list[index - 1].id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (finished) return <Done state={state} />;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
          Welcome to OneShetland
        </p>
        <h1 className="mt-1 font-display text-4xl font-bold text-ink">
          Let&apos;s get you set up
        </h1>
        <p className="mt-2 text-lg text-ink-soft">
          Two minutes, and you can skip anything you&apos;re not sure about — it&apos;s all
          in your account settings later.
        </p>
      </header>

      <Rail list={list} current={step} onJump={setStep} />

      <div className="mt-6">
        {step === "you" && <StepYou state={state} onNext={next} />}
        {step === "audience" && <StepAudience userId={state.userId} onNext={next} />}
        {step === "card" && <StepCard state={state} onNext={next} />}
        {step === "payouts" && <StepPayouts state={state} onNext={next} />}
        {step === "business" && <StepBusiness state={state} onNext={() => setFinished(true)} />}
      </div>

      <div className="mt-6 flex items-center justify-between">
        {index > 0 ? (
          <button
            type="button"
            onClick={back}
            className="rounded-pill px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => {
            router.push("/");
          }}
          className="rounded-pill px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
        >
          Finish later
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────── progress rail ─────────────────────────── */

function Rail({
  list,
  current,
  onJump,
}: {
  list: ReturnType<typeof steps>;
  current: StepId;
  onJump: (id: StepId) => void;
}) {
  return (
    <nav aria-label="Setup progress" className="mt-7">
      <ol className="flex flex-wrap gap-2">
        {list.map((s) => {
          const active = s.id === current;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onJump(s.id)}
                aria-current={active ? "step" : undefined}
                className={`rounded-pill border px-3.5 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "border-navy bg-navy text-white"
                    : s.done
                      ? "border-line bg-paper text-ink-soft hover:bg-sand"
                      : "border-line bg-paper text-ink-muted hover:bg-sand"
                }`}
              >
                {s.done && !active && <span aria-hidden="true">✓ </span>}
                {s.label}
                {s.optional && !active && (
                  <span className="ml-1 font-normal text-ink-faint">· optional</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ─────────────────────────── shared bits ─────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-paper p-6 shadow-soft sm:p-8">
      {children}
    </section>
  );
}

function Title({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <>
      <h2 className="font-display text-2xl font-bold text-ink">{children}</h2>
      {sub && <p className="mt-1.5 text-ink-soft">{sub}</p>}
    </>
  );
}

function Primary({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-pill bg-navy px-6 py-3 font-semibold text-white transition hover:bg-navy-dark disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SkipButton({ onClick, label = "Skip for now" }: { onClick: () => void; label?: string }) {
  // Deliberately a proper button, not a faint link. If skipping looks furtive,
  // people assume they're doing something wrong by skipping.
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-pill border border-line-strong px-6 py-3 font-semibold text-ink transition hover:bg-sand"
    >
      {label}
    </button>
  );
}

function OptionalBadge() {
  return (
    <span className="rounded-pill bg-sand px-3 py-1 text-sm font-semibold text-ink-soft">
      Optional
    </span>
  );
}

/* ─────────────────────────── 1. You ─────────────────────────── */

type HandleState = "idle" | "checking" | "free" | "taken" | "invalid";

function StepYou({ state, onNext }: { state: OnboardingState; onNext: () => void }) {
  const [displayName, setDisplayName] = useState(state.displayName || state.fullName);
  const [area, setArea] = useState(state.locationArea);
  const [handle, setHandle] = useState(state.gamesHandle);
  const [avatar, setAvatar] = useState(state.avatarUrl);
  // The lookup result is keyed to the handle it was for. That makes "checking"
  // a derived state (result doesn't match what's typed yet) rather than a
  // stored one, so a stale answer for a previous handle can never be shown.
  const [checked, setChecked] = useState<{ value: string; taken: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Shape is DERIVED, not stored — an empty or malformed handle needs no async
  // work and no state write, so those paths never touch the effect at all.
  const trimmed = handle.trim();
  const needsCheck =
    trimmed.length > 0 && trimmed !== state.gamesHandle && HANDLE_PATTERN.test(trimmed);
  const handleState: HandleState =
    !trimmed || trimmed === state.gamesHandle
      ? "idle"
      : !HANDLE_PATTERN.test(trimmed)
        ? "invalid"
        : checked?.value === trimmed
          ? checked.taken
            ? "taken"
            : "free"
          : "checking";

  // Only the genuinely async part lives in an effect: is this one taken? Same
  // rules as the profile editor, so the two can never disagree.
  useEffect(() => {
    if (!needsCheck) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await createClient()
          .from("profiles")
          .select("id")
          .eq("games_handle", trimmed)
          .neq("id", state.userId)
          .maybeSingle();
        if (!cancelled) setChecked({ value: trimmed, taken: Boolean(data) });
      } catch {
        // A lookup blip shouldn't block someone from finishing sign-up; the
        // database's own unique constraint is the real guard.
        if (!cancelled) setChecked({ value: trimmed, taken: false });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [needsCheck, trimmed, state.userId]);

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const sb = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${state.userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      setAvatar(sb.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? `Photo upload failed: ${err.message}` : "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return setError("Please enter a name people will see.");
    if (handleState === "taken" || handleState === "invalid")
      return setError("Choose a different games alias, or clear it for now.");

    setBusy(true);
    setError(null);
    try {
      const { error: dbErr } = await createClient()
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          location_area: area || null,
          games_handle: handle.trim() || null,
          avatar_url: avatar || null,
        })
        .eq("id", state.userId);
      if (dbErr) throw dbErr;
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const msg: Record<HandleState, string> = {
    idle: "",
    checking: "Checking…",
    free: "Available ✓",
    taken: "Already taken",
    invalid: HANDLE_HINT,
  };
  const tone: Record<HandleState, string> = {
    idle: "",
    checking: "text-ink-muted",
    free: "text-emerald-600",
    taken: "text-rose-600",
    invalid: "text-rose-600",
  };

  return (
    <Card>
      <form onSubmit={save} className="space-y-6">
        <Title sub="Just the bits that show up when you post, apply for a job or join a hub.">
          A little about you
        </Title>

        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-sand font-display text-2xl font-bold text-ink-faint">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              (displayName || "?").slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-40"
            >
              {uploading ? "Uploading…" : avatar ? "Change photo" : "Add a photo"}
            </button>
            {avatar && (
              <button
                type="button"
                onClick={() => setAvatar("")}
                className="ml-2 text-sm font-semibold text-ink-muted hover:text-ink"
              >
                Remove
              </button>
            )}
            <p className="mt-1 text-sm text-ink-faint">Optional — a photo is friendlier, that&apos;s all.</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={onAvatar} className="hidden" />
          </div>
        </div>

        <div>
          <label htmlFor="w-name" className="block text-sm font-semibold text-ink">
            Name people see
          </label>
          <input
            id="w-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="auth-input mt-1.5"
            autoComplete="name"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="w-area" className="block text-sm font-semibold text-ink">
              Where in Shetland?
            </label>
            <select
              id="w-area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="auth-input mt-1.5"
            >
              <option value="">Rather not say</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-ink-faint">
              Used to show you things nearby first. Never shown on your profile.
            </p>
          </div>

          <div>
            <label htmlFor="w-handle" className="block text-sm font-semibold text-ink">
              Games alias
            </label>
            <input
              id="w-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. peerie_dodie"
              className="auth-input mt-1.5"
              autoComplete="off"
            />
            <p className={`mt-1 text-sm ${tone[handleState] || "text-ink-faint"}`}>
              {msg[handleState] || `Your name on the Guess Da Wird leaderboard. ${HANDLE_HINT}.`}
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Primary type="submit" disabled={busy || uploading}>
            {busy ? "Saving…" : "Save and continue"}
          </Primary>
        </div>
      </form>
    </Card>
  );
}

/* ─────────────────────────── 2. Your Shetland ─────────────────────────── */

function StepAudience({ userId, onNext }: { userId: string; onNext: () => void }) {
  const [choice, setChoice] = useState<Audience | null>(null);

  function pick(a: Audience) {
    setChoice(a);
    // Same cookie the homepage reads, written exactly as AudienceChip does it.
    // (The react-hooks/immutability rule flags `document.cookie` as a module
    // variable write — a false positive; AudienceChip carries the same one.)
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${AUDIENCE_COOKIE}=${a}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

    // Best-effort profile sync so the phone app agrees with the website.
    void (async () => {
      try {
        await createClient().from("profiles").update({ audience: a }).eq("id", userId);
      } catch {
        /* the cookie already did the useful part */
      }
    })();

    setTimeout(onNext, 220);
  }

  const options: { id: Audience; emoji: string; title: string; blurb: string }[] = [
    {
      id: "resident",
      emoji: "🏠",
      title: "I live here",
      blurb: "Lead with what's on, local businesses, jobs and shifts, and the noticeboard.",
    },
    {
      id: "visiting",
      emoji: "🧳",
      title: "I'm visiting",
      blurb: "Lead with things to do, places to eat and stay, cruise days and the dialect.",
    },
  ];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <Title sub="This just reorders the homepage. Nothing gets hidden, and you can flip it any time.">
          What brings you to OneShetland?
        </Title>
        <OptionalBadge />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => pick(o.id)}
            className={`rounded-card border-2 p-5 text-left transition ${
              choice === o.id
                ? "border-navy bg-sand"
                : "border-line bg-paper hover:border-line-strong hover:bg-sand"
            }`}
          >
            <span aria-hidden="true" className="text-2xl">
              {o.emoji}
            </span>
            <span className="mt-2 block font-display text-lg font-bold text-ink">{o.title}</span>
            <span className="mt-1 block text-sm text-ink-soft">{o.blurb}</span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        <SkipButton onClick={onNext} label="Neither, really — skip" />
      </div>
    </Card>
  );
}

/* ─────────────────────────── 3. Paying ─────────────────────────── */

function StepCard({ state, onNext }: { state: OnboardingState; onNext: () => void }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <Title sub="Only if you want to. You can add one later, or at the moment you first buy something.">
          A card for paying
        </Title>
        <OptionalBadge />
      </div>

      <p className="mt-4 text-ink-soft">
        One card covers everything across OneShetland — a Fetch delivery, an event ticket, a
        donation to a hub, a membership. It sits there until you actually buy something.
      </p>

      <ul className="mt-4 space-y-2 text-sm text-ink-soft">
        <li className="flex gap-2.5">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
          <span>
            Your card details go straight to <strong className="font-semibold text-ink">Stripe</strong>{" "}
            — they never touch OneShetland. I only ever see the last four digits.
          </span>
        </li>
        <li className="flex gap-2.5">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
          <span>Nothing is charged now, and nothing is charged without you choosing it.</span>
        </li>
        <li className="flex gap-2.5">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
          <span>Remove it in one click from your account, any time.</span>
        </li>
      </ul>

      <div className="mt-6">
        <CardSetup accent={NAVY} hasCard={state.hasCard} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {state.hasCard ? (
          <Primary onClick={onNext}>Continue</Primary>
        ) : (
          <SkipButton onClick={onNext} label="No card for now" />
        )}
      </div>
    </Card>
  );
}

/* ─────────────────────────── 4. Getting paid ─────────────────────────── */

function StepPayouts({ state, onNext }: { state: OnboardingState; onNext: () => void }) {
  const connected = state.payoutsConnected || state.payoutsPending;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <Title sub="Only needed if money will be coming TO you. Most people can skip this.">
          Getting paid
        </Title>
        <OptionalBadge />
      </div>

      <p className="mt-4 text-ink-soft">
        Connect a bank account if you&apos;ll be earning through OneShetland — driving for
        Fetch, selling something, or taking payments for a hub you run. One connection covers
        everything you get paid for personally.
      </p>

      <ul className="mt-4 space-y-2 text-sm text-ink-soft">
        <li className="flex gap-2.5">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
          <span>
            Stripe handles the setup and the identity checks — your account number goes to
            them, not to me.
          </span>
        </li>
        <li className="flex gap-2.5">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
          <span>
            They&apos;ll ask for ID. That&apos;s a legal requirement for anyone receiving money,
            not something OneShetland has added.
          </span>
        </li>
        <li className="flex gap-2.5">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
          <span>It opens in a Stripe window and takes about five minutes.</span>
        </li>
      </ul>

      <div className="mt-6">
        <ConnectPayoutsButton
          accent={NAVY}
          connected={state.payoutsConnected}
          pending={state.payoutsPending}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {connected ? (
          <Primary onClick={onNext}>Continue</Primary>
        ) : (
          <SkipButton onClick={onNext} label="I'm not getting paid — skip" />
        )}
      </div>
    </Card>
  );
}

/* ─────────────────────────── 5. Your business ─────────────────────────── */

function StepBusiness({ state, onNext }: { state: OnboardingState; onNext: () => void }) {
  const has = state.ownedBusinesses.length > 0;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <Title
            sub={
              has
                ? "You're already looking after these."
                : "If you run something in Shetland, it may already be listed — take it over and it's yours."
            }
          >
            {has ? "Your business" : "Do you run a business?"}
          </Title>
          <OptionalBadge />
        </div>

        {has ? (
          <div className="mt-5 space-y-2">
            {state.ownedBusinesses.map((b) => (
              <Link
                key={b.id}
                href={`/business/${b.id}/manage`}
                className="flex items-center justify-between rounded-xl border border-line px-4 py-3 font-semibold text-ink hover:bg-sand"
              >
                {b.name}
                <span className="text-ink-faint">Manage →</span>
              </Link>
            ))}
          </div>
        ) : (
          <>
            <p className="mt-4 text-ink-soft">
              There are over 500 Shetland businesses already in the directory, pulled together
              from public sources. Yours might be one of them — with the wrong opening hours and
              no photos, because nobody&apos;s claimed it yet.
            </p>
            {/* Search happens HERE rather than on /directory — sending someone
                out of the wizard to look was losing them before they'd found
                anything. */}
            <div className="mt-5">
              <BusinessClaimSearch />
            </div>
            <p className="mt-4 text-sm text-ink-faint">
              Free to be listed, and nothing to cancel if you change your mind. Not in the
              list?{" "}
              <Link
                href="/directory/new"
                className="font-semibold text-navy underline underline-offset-2"
              >
                Add your business
              </Link>
              .
            </p>
          </>
        )}
      </Card>

      {!has && <SoftLaunchNotice variant="business" />}

      <div>
        <Primary onClick={onNext}>{has ? "All done" : "Not right now — finish"}</Primary>
      </div>
    </div>
  );
}

/* ─────────────────────────── done ─────────────────────────── */

function Done({ state }: { state: OnboardingState }) {
  const name = (state.displayName || state.fullName || "").split(" ")[0];

  const links = [
    { href: "/whats-on", label: "See what's on", blurb: "Events across the isles" },
    { href: "/directory", label: "Browse the directory", blurb: "Every Shetland business" },
    { href: "/games/guess-da-wird", label: "Play Guess Da Wird", blurb: "Today's dialect word" },
    { href: "/jobs", label: "Look at jobs", blurb: "Work across Shetland" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-wide text-ink-faint">All set</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-ink">
        {name ? `Welcome aboard, ${name}` : "Welcome aboard"}
      </h1>
      <p className="mt-2 text-lg text-ink-soft">
        Everything else lives in{" "}
        <Link href="/account" className="font-semibold text-navy underline underline-offset-2">
          your account
        </Link>{" "}
        — change any of it whenever you like.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-card border border-line bg-paper p-5 shadow-soft transition hover:shadow-lift"
          >
            <span className="block font-display text-lg font-bold text-ink">{l.label}</span>
            <span className="mt-0.5 block text-sm text-ink-soft">{l.blurb}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <SoftLaunchNotice />
      </div>
    </div>
  );
}
