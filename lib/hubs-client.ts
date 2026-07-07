"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  HubType, JoinMode, NoticeVisibility, MembershipPeriod, HubMembershipType,
} from "@/lib/hubs-data";

/* ── Membership ────────────────────────────────────────────────────────────── */

export async function joinHub(hubId: string, membershipTypeId?: string | null): Promise<void> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Please sign in to join.");
  // Re-join path: clear any prior 'left'/'rejected' row first.
  await sb.from("hub_members").delete().eq("hub_id", hubId).eq("user_id", user.id).in("status", ["left", "rejected"]);
  const { error } = await sb.from("hub_members").insert({
    hub_id: hubId,
    user_id: user.id,
    role: "member",
    membership_type_id: membershipTypeId ?? null,
  });
  if (error) throw error;
}

export async function leaveHub(hubId: string): Promise<void> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { error } = await sb.from("hub_members").delete().eq("hub_id", hubId).eq("user_id", user.id);
  if (error) throw error;
}

function invokeError(error: { message: string; context?: { json?: () => Promise<{ error?: string }> } }): Promise<never> {
  return (async () => {
    let msg = error.message;
    try { const b = await error.context?.json?.(); if (b?.error) msg = b.error; } catch { /* */ }
    throw new Error(msg);
  })();
}

export type PaymentStart = { charged?: boolean; payment_intent_id: string; clientSecret?: string };

/** Start payment for a paid membership tier. */
export async function startMembershipPayment(membershipTypeId: string, useSavedCard = true): Promise<PaymentStart> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("create-hub-membership-intent", {
    body: { membership_type_id: membershipTypeId, use_saved_card: useSavedCard },
  });
  if (error) return invokeError(error);
  return data as PaymentStart;
}

export async function confirmMembership(paymentIntentId: string): Promise<{ ok: boolean; member_no: string | null; paid_until: string | null }> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("confirm-hub-membership", {
    body: { payment_intent_id: paymentIntentId },
  });
  if (error) return invokeError(error);
  return data;
}

/* ── Donations ─────────────────────────────────────────────────────────────── */

export type GiftAid = { title?: string | null; first_name: string; last_name: string; address: string; postcode: string };

export async function startDonation(campaignId: string, amountPence: number, useSavedCard = true, coverFees = false): Promise<PaymentStart> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("create-hub-donation-intent", {
    body: { campaign_id: campaignId, amount_pence: amountPence, use_saved_card: useSavedCard, cover_fees: coverFees },
  });
  if (error) return invokeError(error);
  return data as PaymentStart;
}

export async function confirmDonation(
  paymentIntentId: string,
  opts: { message?: string | null; anonymous?: boolean; giftAid?: GiftAid | null } = {},
): Promise<{ ok: boolean }> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("confirm-hub-donation", {
    body: {
      payment_intent_id: paymentIntentId,
      message: opts.message ?? null,
      anonymous: opts.anonymous ?? false,
      gift_aid: opts.giftAid ?? null,
    },
  });
  if (error) return invokeError(error);
  return data;
}

/* ── Admin: members ────────────────────────────────────────────────────────── */

export async function approveMember(memberId: string): Promise<void> {
  const sb = createClient();
  const { data, error } = await sb.from("hub_members").update({ status: "active" }).eq("id", memberId).select("hub_id, user_id").single();
  if (error) throw error;
  // Tell the member they're in (same edge fn the app uses).
  if (data) sb.functions.invoke("notify-hub", { body: { event: "approved", hub_id: data.hub_id, user_id: data.user_id } }).catch(() => {});
}
export async function rejectMember(memberId: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("hub_members").update({ status: "rejected" }).eq("id", memberId);
  if (error) throw error;
}
export async function setMemberRole(memberId: string, role: "member" | "committee"): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("hub_members").update({ role }).eq("id", memberId);
  if (error) throw error;
}

/* ── Admin: notices ────────────────────────────────────────────────────────── */

export async function createNotice(hubId: string, input: { title: string; body?: string; visibility?: NoticeVisibility; image_url?: string | null; expires_at?: string | null }): Promise<void> {
  const sb = createClient();
  const { data, error } = await sb.from("notices").insert({
    publisher_hub_id: hubId,
    severity: "community",
    visibility: input.visibility ?? "public",
    title: input.title,
    body: input.body ?? null,
    image_url: input.image_url ?? null,
    expires_at: input.expires_at ?? null,
  }).select("id").single();
  if (error) throw error;
  // Notify active members (same edge fn the app uses).
  if (data?.id) sb.functions.invoke("notify-hub-content", { body: { event: "notice", hub_id: hubId, ref_id: data.id, title: input.title } }).catch(() => {});
}
export async function deleteNotice(id: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("notices").delete().eq("id", id);
  if (error) throw error;
}

/* ── Admin: documents ──────────────────────────────────────────────────────── */

export async function createDocument(hubId: string, input: { title: string; url: string; visibility?: NoticeVisibility }): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("hub_documents").insert({
    hub_id: hubId, title: input.title, url: input.url, visibility: input.visibility ?? "members",
  });
  if (error) throw error;
}
export async function deleteDocument(id: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("hub_documents").delete().eq("id", id);
  if (error) throw error;
}

/* ── Admin: membership tiers ───────────────────────────────────────────────── */

export async function createMembershipType(hubId: string, input: { name: string; description?: string; price_pence: number; period: MembershipPeriod; benefits?: string }): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("hub_membership_types").insert({
    hub_id: hubId, name: input.name, description: input.description ?? null,
    price_pence: input.price_pence, period: input.period, benefits: input.benefits ?? null,
  });
  if (error) throw error;
}
export async function updateMembershipType(id: string, patch: Partial<HubMembershipType>): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("hub_membership_types").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteMembershipType(id: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("hub_membership_types").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

/* ── Admin: campaigns ──────────────────────────────────────────────────────── */

export async function createCampaign(hubId: string, input: { title: string; story?: string; goal_pence: number; cover_url?: string | null; ends_at?: string | null }): Promise<{ id: string }> {
  const sb = createClient();
  const { data, error } = await sb.from("hub_campaigns").insert({
    hub_id: hubId, title: input.title, story: input.story ?? null,
    goal_pence: input.goal_pence, cover_url: input.cover_url ?? null, ends_at: input.ends_at ?? null,
  }).select("id").single();
  if (error) throw error;
  return data as { id: string };
}
export async function updateCampaign(id: string, patch: { title?: string; story?: string; goal_pence?: number; status?: "active" | "closed"; cover_url?: string | null }): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("hub_campaigns").update(patch).eq("id", id);
  if (error) throw error;
}

/* ── Admin: broadcast ──────────────────────────────────────────────────────── */

export async function broadcastToHub(hubId: string, input: { title: string; message: string; channel: "push" | "email" | "both" }): Promise<{ ok: boolean; members: number }> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("hub-broadcast", {
    body: { hub_id: hubId, title: input.title, message: input.message, channel: input.channel },
  });
  if (error) return invokeError(error);
  return data;
}

/* ── Events ────────────────────────────────────────────────────────────────── */

export type TicketMode = "none" | "oneshetland" | "external";

export type WebTicketType = { name: string; price_pence: number; quantity_available?: number | null };

export async function createHubEvent(hubId: string, input: {
  title: string;
  starts_at: string;
  ends_at?: string | null;
  venue?: string | null;
  locality?: string | null;
  category?: string | null;
  price_text?: string | null;
  cover_url?: string | null;
  hub_visibility: "members" | "hub" | "islands";
  ticket_mode?: TicketMode;
  ticket_url?: string | null;
  ticket_types?: WebTicketType[];
}): Promise<string> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Please sign in.");
  const hasTickets = (input.ticket_mode ?? "none") !== "none";
  const { data: ev, error } = await sb.from("events").insert({
    organiser_user_id: user.id,
    organiser_hub_id: hubId,
    hub_visibility: input.hub_visibility,
    title: input.title,
    starts_at: input.starts_at,
    ends_at: input.ends_at ?? null,
    venue: input.venue ?? null,
    locality: input.locality ?? null,
    category: input.category ?? null,
    price_text: input.price_text ?? null,
    cover_url: input.cover_url ?? null,
    has_tickets: hasTickets,
    ticket_url: input.ticket_mode === "external" ? (input.ticket_url ?? null) : null,
    status: "published",
  }).select("id").single();
  if (error || !ev) throw error ?? new Error("Failed to create event");
  if (input.ticket_mode === "oneshetland" && input.ticket_types?.length) {
    await sb.from("event_ticket_types").insert(
      input.ticket_types
        .filter(t => t.name.trim())
        .map((t, i) => ({
          event_id: ev.id,
          name: t.name.trim(),
          price_pence: t.price_pence,
          quantity_available: t.quantity_available ?? null,
          display_order: i,
          is_active: true,
        })),
    );
  }
  // Tell the hub's members about the new (published) event.
  sb.functions.invoke("notify-hub-content", { body: { event: "event", hub_id: hubId, ref_id: ev.id, title: input.title } }).catch(() => {});
  return ev.id;
}

export async function updateHubEvent(id: string, input: {
  title?: string;
  starts_at?: string;
  ends_at?: string | null;
  venue?: string | null;
  locality?: string | null;
  category?: string | null;
  price_text?: string | null;
  hub_visibility?: "members" | "hub" | "islands";
  status?: "published" | "cancelled" | "draft";
  ticket_mode?: TicketMode;
  ticket_url?: string | null;
  ticket_types?: WebTicketType[];
}): Promise<void> {
  const sb = createClient();
  const { ticket_mode, ticket_url, ticket_types, ...rest } = input;
  const patch: Record<string, unknown> = { ...rest };
  if (ticket_mode !== undefined) {
    patch.has_tickets = ticket_mode !== "none";
    patch.ticket_url = ticket_mode === "external" ? (ticket_url ?? null) : null;
  }
  const { error } = await sb.from("events").update(patch).eq("id", id);
  if (error) throw error;
  if (ticket_mode === "oneshetland" && ticket_types !== undefined) {
    await sb.from("event_ticket_types").delete().eq("event_id", id);
    if (ticket_types.length) {
      await sb.from("event_ticket_types").insert(
        ticket_types
          .filter(t => t.name.trim())
          .map((t, i) => ({
            event_id: id,
            name: t.name.trim(),
            price_pence: t.price_pence,
            quantity_available: t.quantity_available ?? null,
            display_order: i,
            is_active: true,
          })),
      );
    }
  }
}

export async function deleteEvent(id: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("events").delete().eq("id", id);
  if (error) throw error;
}

/* ── Stripe Connect payout onboarding ──────────────────────────────────────── */

/** Start/resume the hub's Stripe Connect onboarding; returns a URL to redirect to. */
export async function startHubOnboarding(hubId: string, webReturnUrl?: string): Promise<string> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("hub-onboard", {
    body: { hub_id: hubId, web_return_url: webReturnUrl },
  });
  if (error) return invokeError(error);
  const url = (data as { url?: string })?.url;
  if (!url) throw new Error("Could not start payout setup.");
  return url;
}

/* ── Create / edit hub ─────────────────────────────────────────────────────── */

export type HubInput = {
  name: string;
  type: HubType;
  description?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  brand_color?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  area?: string | null;
  join_mode?: JoinMode;
  directory_enabled?: boolean;
  is_charity?: boolean;
  charity_number?: string | null;
};

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export async function createHub(input: HubInput): Promise<{ id: string; slug: string | null }> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Please sign in.");
  const slug = `${slugify(input.name)}-${Math.abs(hashCode(user.id + input.name)).toString(36).slice(0, 4)}`;
  const { data, error } = await sb.from("hubs").insert({
    owner_id: user.id,
    name: input.name,
    slug,
    type: input.type,
    description: input.description ?? null,
    logo_url: input.logo_url ?? null,
    cover_url: input.cover_url ?? null,
    brand_color: input.brand_color ?? null,
    contact_email: input.contact_email ?? null,
    contact_phone: input.contact_phone ?? null,
    website: input.website ?? null,
    area: input.area ?? null,
    join_mode: input.join_mode ?? "approval",
    directory_enabled: input.directory_enabled ?? false,
    is_charity: input.is_charity ?? false,
    charity_number: input.charity_number ?? null,
  }).select("id, slug").single();
  if (error) throw error;
  return data as { id: string; slug: string | null };
}

export async function updateHub(id: string, patch: Partial<HubInput>): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("hubs").update(patch).eq("id", id);
  if (error) throw error;
}

/** Upload a hub logo/cover to the public `hub-media` bucket. Returns the public URL. */
export async function uploadHubMedia(hubId: string, kind: "logo" | "cover", file: File): Promise<string> {
  const sb = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${hubId}/${kind}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from("hub-media").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = sb.storage.from("hub-media").getPublicUrl(path);
  return data.publicUrl;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
