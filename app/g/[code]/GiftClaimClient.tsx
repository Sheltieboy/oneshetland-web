"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  claimGift, fetchGiftEligibility, sendGiftRecipientCode, confirmGiftRecipientCode,
} from "@/lib/local-commerce-client";
import { fetchGiftPreview, type GiftPreview } from "@/lib/passes-data";

const LOCAL = "#7c3aed";

function friendlyError(message: string): string {
  if (message.includes("gift_already_claimed")) return "This gift has already been claimed by someone else.";
  if (message.includes("gift_expired")) return "This gift has expired.";
  if (message.includes("gift_not_paid")) return "The sender hasn't completed payment yet.";
  if (message.includes("gift_cancelled")) return "This gift was cancelled.";
  if (message.includes("gift_not_found")) return "We couldn't find that gift code.";
  if (message.includes("auth_required")) return "Please sign in to claim this gift.";
  if (message.includes("gift_recipient_verification_required"))
    return "Verify the email this gift was sent to before claiming it.";
  if (message.includes("gift_has_no_recipient_email"))
    return "This gift has no delivery address — ask the sender to resend it.";
  return "Couldn't claim the gift. Please try again.";
}

export function GiftClaimClient({ code }: { code: string }) {
  const router = useRouter();
  const [gift, setGift] = useState<GiftPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimedUnit, setClaimedUnit] = useState(false);
  const [bookingTarget, setBookingTarget] = useState<{ businessId: string } | null>(null);

  // Recipient identity. `state` decides which of the three signed-in shapes the
  // page takes: claim, verify, or "this one isn't yours".
  const [eligibility, setEligibility] = useState<{ state: string; masked_email: string | null } | null>(null);
  const [verifyStep, setVerifyStep] = useState<"idle" | "sending" | "code">("idle");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const signInHref = `/sign-in?next=${encodeURIComponent(`/g/${code}`)}`;

  useEffect(() => {
    let live = true;
    (async () => {
      const sb = createClient();
      const { data: auth } = await sb.auth.getUser();
      if (live) setIsLoggedIn(!!auth.user);

      const [preview, elig] = await Promise.all([
        fetchGiftPreview(code),
        fetchGiftEligibility(code),
      ]);
      if (!live) return;
      if (!preview) {
        setLoadError("We couldn't find that gift. Check the code or ask the sender to resend.");
      } else {
        setGift(preview);
        setEligibility(elig);
      }
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [code]);

  const refreshEligibility = useCallback(async () => {
    setEligibility(await fetchGiftEligibility(code));
  }, [code]);

  /** Send the one-time code to the address the gift was addressed to. */
  const startVerify = useCallback(async () => {
    setVerifyError(null);
    setVerifyStep("sending");
    try {
      await sendGiftRecipientCode(code);
      setVerifyStep("code");
    } catch (e) {
      setVerifyStep("idle");
      setVerifyError(e instanceof Error ? friendlyError(e.message) : "Couldn't send the code.");
    }
  }, [code]);

  const submitVerify = useCallback(async () => {
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      const r = await confirmGiftRecipientCode(code, verifyCode);
      if (r.ok) {
        await refreshEligibility();
        setVerifyStep("idle");
        setVerifyCode("");
      } else if (r.error === "verification_locked") {
        setVerifyError("Too many wrong codes. Send a new one to try again.");
      } else if (r.error === "verification_expired") {
        setVerifyError("That code has expired. Send a new one.");
      } else if (r.error === "verification_not_found") {
        setVerifyError("Send a code first, then enter it here.");
      } else {
        const left = r.attempts_left;
        setVerifyError(`That code isn't right.${typeof left === "number" ? ` ${left} ${left === 1 ? "try" : "tries"} left.` : ""}`);
      }
    } catch (e) {
      setVerifyError(e instanceof Error ? friendlyError(e.message) : "Couldn't check that code.");
    } finally {
      setVerifyBusy(false);
    }
  }, [code, verifyCode, refreshEligibility]);

  const claim = useCallback(async () => {
    if (!gift) return;
    if (!isLoggedIn) {
      router.push(signInHref);
      return;
    }
    setClaiming(true);
    setClaimError(null);
    try {
      const result = await claimGift(gift.code);
      if (result.kind === "booking" && result.business_id) {
        // Booking gift: the recipient still needs to pick a slot. The booking flow
        // lives on the business page; we send them there with the gift attached.
        setBookingTarget({ businessId: result.business_id });
      } else {
        // Unit gift: the purchase row is already spawned — it now lives in Passes.
        setClaimedUnit(true);
        setGift({ ...gift, status: "used" });
      }
    } catch (e) {
      setClaimError(friendlyError(e instanceof Error ? e.message : ""));
    } finally {
      setClaiming(false);
    }
  }, [gift, isLoggedIn, router, signInHref]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-sand" />
        <div className="mx-auto h-6 w-2/3 animate-pulse rounded bg-sand" />
        <div className="mx-auto h-4 w-1/2 animate-pulse rounded bg-sand" />
      </div>
    );
  }

  if (loadError || !gift) {
    return (
      <div className="rounded-xl border border-line bg-paper p-8 text-center shadow-soft">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sand text-2xl">🎁</div>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Gift not found</h1>
        <p className="mt-2 text-sm text-ink-muted">{loadError ?? "Try the link again from your email."}</p>
        <Link
          href="/directory"
          className="mt-5 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-paper"
          style={{ background: LOCAL }}
        >
          Browse OneShetland
        </Link>
      </div>
    );
  }

  // Booking gift just claimed → send them on to pick a slot.
  if (bookingTarget) {
    return (
      <div className="rounded-xl border border-line bg-paper p-8 text-center shadow-soft">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl" style={{ background: `${LOCAL}1a` }}>
          📅
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Gift claimed!</h1>
        <p className="mt-2 text-sm text-ink-muted">
          You can now pick a time for <span className="font-semibold text-ink">{gift.item_name}</span> at{" "}
          {gift.business_name}. Open the business to choose your slot — your gift is already attached.
        </p>
        <Link
          href={`/directory/${bookingTarget.businessId}`}
          className="mt-5 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-paper"
          style={{ background: LOCAL }}
        >
          Pick a time
        </Link>
        <p className="mt-3 text-xs text-ink-muted">
          You can also find it any time under{" "}
          <Link href="/account/gifts" className="font-semibold underline">My gifts</Link>.
        </p>
      </div>
    );
  }

  // Unit gift just claimed → it's in Passes now.
  if (claimedUnit) {
    return (
      <div className="rounded-xl border border-line bg-paper p-8 text-center shadow-soft">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl" style={{ background: `${LOCAL}1a` }}>
          ✅
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Added to your passes!</h1>
        <p className="mt-2 text-sm text-ink-muted">
          <span className="font-semibold text-ink">{gift.item_name}</span> at {gift.business_name} is ready to use.
        </p>
        <Link
          href="/account/passes"
          className="mt-5 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-paper"
          style={{ background: LOCAL }}
        >
          View my passes
        </Link>
      </div>
    );
  }

  const alreadyUsed = gift.status === "used";

  return (
    <div className="rounded-xl border border-line bg-paper p-8 text-center shadow-soft">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full text-4xl" style={{ background: `${LOCAL}1a` }}>
        🎁
      </div>

      <p className="mt-5 text-xs font-bold uppercase tracking-widest text-ink-muted">You've got a gift</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-ink">{gift.item_name}</h1>
      <p className="mt-1 text-sm text-ink-muted">at {gift.business_name}</p>

      {gift.purchaser_name && (
        <p className="mt-3 text-sm text-ink">
          From <span className="font-bold">{gift.purchaser_name}</span>
        </p>
      )}

      {gift.message && (
        <div className="mt-4 rounded-card border-l-4 bg-sand p-4 text-left" style={{ borderColor: LOCAL }}>
          <p className="text-sm italic text-ink">&ldquo;{gift.message}&rdquo;</p>
        </div>
      )}

      {claimError && (
        <p className="mt-4 rounded-card border border-line bg-paper px-4 py-3 text-sm text-rose-600">{claimError}</p>
      )}

      <div className="mt-6">
        {alreadyUsed ? (
          <div className="rounded-card border border-line bg-sand px-4 py-3 text-sm font-semibold text-ink">
            ✓ This gift has already been claimed.
          </div>
        ) : isLoggedIn === false ? (
          <>
            <p className="mb-3 text-sm text-ink-muted">Sign in or create an account to claim it.</p>
            <Link
              href={signInHref}
              className="inline-block w-full rounded-pill px-5 py-3 text-sm font-semibold text-paper"
              style={{ background: LOCAL }}
            >
              Sign in to claim
            </Link>
          </>
        ) : eligibility?.state === "gift_already_claimed" ? (
          <div className="rounded-card border border-line bg-sand px-4 py-3 text-sm font-semibold text-ink">
            This gift has already been claimed.
          </div>
        ) : eligibility?.state === "verification_required" ? (
          /* Signed in under a different address. We do NOT say whether that
             address has an account — only that it isn't the one in this
             browser, and offer the two honest ways forward. */
          <div className="rounded-card border border-line bg-sand p-4 text-left">
            <p className="text-sm text-ink">
              This gift was sent to{" "}
              <span className="font-bold">{eligibility.masked_email ?? "another email address"}</span>.
              You&rsquo;re signed in to OneShetland with a different email.
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              If this gift is for you, verify the address it was sent to and we&rsquo;ll add it to the
              account you&rsquo;re using now. You won&rsquo;t need a second account.
            </p>

            {verifyStep !== "code" ? (
              <button
                onClick={startVerify}
                disabled={verifyStep === "sending"}
                className="mt-4 w-full rounded-pill px-5 py-3 text-sm font-semibold text-paper transition hover:brightness-95 disabled:opacity-70"
                style={{ background: LOCAL }}
              >
                {verifyStep === "sending" ? "Sending…" : "Verify recipient email"}
              </button>
            ) : (
              <div className="mt-4">
                <label htmlFor="giftcode" className="block text-xs font-bold uppercase tracking-widest text-ink-muted">
                  Code from that inbox
                </label>
                <input
                  id="giftcode"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  autoComplete="one-time-code"
                  inputMode="text"
                  placeholder="ABCD2345"
                  className="mt-1 w-full rounded-card border border-line bg-paper px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-ink"
                />
                <button
                  onClick={submitVerify}
                  disabled={verifyBusy || verifyCode.trim().length < 8}
                  className="mt-3 w-full rounded-pill px-5 py-3 text-sm font-semibold text-paper transition hover:brightness-95 disabled:opacity-70"
                  style={{ background: LOCAL }}
                >
                  {verifyBusy ? "Checking…" : "Confirm code"}
                </button>
                <button onClick={startVerify} className="mt-2 w-full text-xs font-semibold text-ink-soft underline">
                  Send a new code
                </button>
              </div>
            )}

            {verifyError && <p className="mt-3 text-sm text-rose-600">{verifyError}</p>}

            <Link href={signInHref} className="mt-4 block text-center text-sm font-semibold text-ink-soft underline">
              Or switch account
            </Link>
          </div>
        ) : (
          <button
            onClick={claim}
            disabled={claiming}
            className="w-full rounded-pill px-5 py-3 text-sm font-semibold text-paper transition hover:brightness-95 disabled:opacity-70"
            style={{ background: LOCAL }}
          >
            {claiming ? "Claiming…" : gift.kind === "booking" ? "Claim & pick a time" : "Claim my gift"}
          </button>
        )}
      </div>
    </div>
  );
}
