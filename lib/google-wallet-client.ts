"use client";

import { createClient } from "@/lib/supabase/client";

/** What a customer is told. Raw server or Google errors never reach the screen. */
export const GOOGLE_WALLET_UNAVAILABLE = "Google Wallet isn't available right now. Please try again.";
export const GOOGLE_WALLET_SIGN_IN = "Please sign in again to add your card to Google Wallet.";

/** A Save-to-Google-Wallet link, and nothing else, is ever navigated to. */
const SAVE_URL = /^https:\/\/pay\.google\.com\/gp\/v\/save\/[A-Za-z0-9._-]+$/;
const TIMEOUT_MS = 20_000;

/** An error whose message is always safe to show to the customer. */
export class GoogleWalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleWalletError";
  }
}

/**
 * "Add to Google Wallet": ask the google-wallet-pass edge function for a signed
 * save link, then take the customer to it.
 *
 * WHY THE TAB IS OPENED FIRST. The link only exists after a network round trip.
 * Opening a new window once that has returned is no longer "directly triggered by
 * the click", so browsers — Safari reliably, others when the round trip is slow —
 * silently block it: window.open returns null, no exception is thrown, and the
 * button appears to do nothing at all. So the destination tab is opened
 * SYNCHRONOUSLY, inside the click, and sent to the link when it arrives. If even
 * that is blocked, the current tab goes to the link instead. Either way it is the
 * one click, never a second.
 *
 * Callers must invoke this synchronously from the click handler (before any await).
 */
export async function addToGoogleWallet(): Promise<void> {
  const popup = window.open("", "_blank");
  if (popup) { try { popup.opener = null; } catch { /* a blank tab we opened; best effort */ } }
  const closePopup = () => { try { popup?.close(); } catch { /* already gone */ } };

  try {
    const sb = createClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new GoogleWalletError(GOOGLE_WALLET_SIGN_IN);

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/google-wallet-pass`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: ctl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const body = (await res.json().catch(() => ({}))) as { saveUrl?: unknown };
    if (res.status === 401) throw new GoogleWalletError(GOOGLE_WALLET_SIGN_IN);
    if (!res.ok || typeof body.saveUrl !== "string" || !SAVE_URL.test(body.saveUrl)) {
      // Status only: the body may carry operator detail that is not for customers.
      console.error("[google-wallet] no usable save link, HTTP", res.status);
      throw new GoogleWalletError(GOOGLE_WALLET_UNAVAILABLE);
    }

    const url = body.saveUrl;
    if (popup && !popup.closed) {
      try { popup.location.replace(url); return; } catch { /* fall through to this tab */ }
    }
    window.location.assign(url);
  } catch (e) {
    closePopup();
    if (e instanceof GoogleWalletError) throw e;
    console.error("[google-wallet] request failed:", e instanceof Error ? e.name : "error");
    throw new GoogleWalletError(GOOGLE_WALLET_UNAVAILABLE);
  }
}
