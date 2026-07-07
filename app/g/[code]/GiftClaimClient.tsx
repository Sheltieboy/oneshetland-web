"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { claimGift } from "@/lib/local-commerce-client";
import { fetchGiftPreview, type GiftPreview } from "@/lib/passes-data";

const LOCAL = "#7c3aed";

function friendlyError(message: string): string {
  if (message.includes("gift_already_claimed")) return "This gift has already been claimed by someone else.";
  if (message.includes("gift_expired")) return "This gift has expired.";
  if (message.includes("gift_not_paid")) return "The sender hasn't completed payment yet.";
  if (message.includes("gift_cancelled")) return "This gift was cancelled.";
  if (message.includes("gift_not_found")) return "We couldn't find that gift code.";
  if (message.includes("auth_required")) return "Please sign in to claim this gift.";
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

  const signInHref = `/sign-in?next=${encodeURIComponent(`/g/${code}`)}`;

  useEffect(() => {
    let live = true;
    (async () => {
      const sb = createClient();
      const { data: auth } = await sb.auth.getUser();
      if (live) setIsLoggedIn(!!auth.user);

      const preview = await fetchGiftPreview(code);
      if (!live) return;
      if (!preview) {
        setLoadError("We couldn't find that gift. Check the code or ask the sender to resend.");
      } else {
        setGift(preview);
      }
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [code]);

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
            <p className="mb-3 text-sm text-ink-muted">Sign in to claim it to your account.</p>
            <Link
              href={signInHref}
              className="inline-block w-full rounded-pill px-5 py-3 text-sm font-semibold text-paper"
              style={{ background: LOCAL }}
            >
              Sign in to claim
            </Link>
          </>
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
