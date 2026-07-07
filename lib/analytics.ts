"use client";

/**
 * lib/analytics.ts — first-party product analytics (web portal)
 *
 * Batched, consent-aware client. Events flush to the `log_events` RPC (which
 * stamps is_conversion/category from the registry and scrubs PII). Never put
 * money or PII in props — revenue lives in the ledgers and transaction events
 * are fired server-side.
 *
 * Consent model (web): OPT-IN. Nothing is sent until the visitor accepts the
 * cookie/analytics banner (setAnalyticsConsent(true)). Stricter than the app,
 * which is appropriate for an open web audience.
 */

import { createClient } from "./supabase/client";

type UserType = "visitor" | "user" | "seller" | "admin" | "driver";

interface TrackContext {
  props?: Record<string, unknown>;
  objectType?: string;
  objectId?: string;
  businessId?: string | null;
  hubId?: string | null;
  orderId?: string | null;
  occurredAt?: string;
}

const ANON_KEY = "os_analytics_anon_id";
const CONSENT_KEY = "os_analytics_consent";
const FLUSH_MS = 4000;
const MAX_BATCH = 25;

let queue: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let userType: UserType = "visitor";

const isBrowser = typeof window !== "undefined";

function uuid(): string {
  if (isBrowser && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function anonId(): string {
  if (!isBrowser) return "ssr";
  let id = localStorage.getItem(ANON_KEY);
  if (!id) { id = uuid(); localStorage.setItem(ANON_KEY, id); }
  return id;
}

function sessionId(): string {
  if (!isBrowser) return "ssr";
  let id = sessionStorage.getItem("os_analytics_session");
  if (!id) { id = uuid(); sessionStorage.setItem("os_analytics_session", id); }
  return id;
}

export function getAnalyticsConsent(): boolean {
  if (!isBrowser) return false;
  return localStorage.getItem(CONSENT_KEY) === "true";
}

export function setAnalyticsConsent(on: boolean): void {
  if (!isBrowser) return;
  localStorage.setItem(CONSENT_KEY, String(on));
  if (!on) queue = [];
}

export function identifyAnalytics(type: UserType): void { userType = type; }

export function track(eventName: string, ctx: TrackContext = {}): void {
  try {
    if (!isBrowser || !getAnalyticsConsent()) return;
    queue.push({
      event_name: eventName,
      occurred_at: ctx.occurredAt ?? new Date().toISOString(),
      anon_id: anonId(),
      session_id: sessionId(),
      platform: "web",
      user_type: userType,
      object_type: ctx.objectType,
      object_id: ctx.objectId,
      business_id: ctx.businessId ?? undefined,
      hub_id: ctx.hubId ?? undefined,
      order_id: ctx.orderId ?? undefined,
      props: ctx.props ?? {},
      consent: true,
    });
    if (queue.length >= MAX_BATCH) void flushAnalytics();
    else if (!timer) timer = setTimeout(() => void flushAnalytics(), FLUSH_MS);
  } catch { /* never break the page */ }
}

export async function flushAnalytics(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!isBrowser || !getAnalyticsConsent() || queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("log_events", { p_events: batch });
    if (error) queue.unshift(...batch);
  } catch {
    queue.unshift(...batch);
  }
}

// Flush on tab hide (covers most page exits).
if (isBrowser) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushAnalytics();
  });
}
