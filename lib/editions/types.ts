/** Row shapes for OneShetland Editions (mirrors supabase/migrations/20270102000000_editions_foundation.sql). */
export type EditionKind = "single_day" | "multi_day" | "week" | "season" | "campaign";
export type EditionStatus = "draft" | "published" | "archived" | "suspended";
export type OrganiserStatus = "pending" | "verified" | "rejected" | "suspended";
export type OrgRole = "owner" | "admin" | "editor";
export type SessionKind = "event" | "activity" | "session" | "exhibition" | "tour";

export type Organiser = {
  id: string; slug: string; name: string; tagline: string | null; description: string | null;
  logo_url: string | null; cover_url: string | null; cover_focus: string | null; brand_color: string | null; website: string | null; contact_email?: string | null;
  status: OrganiserStatus; verified_at: string | null; is_test: boolean; hub_id: string | null; created_at: string;
};

export type Edition = {
  id: string; organiser_id: string; series_id: string | null; slug: string; title: string; summary: string | null; description: string | null;
  kind: EditionKind; starts_on: string; ends_on: string; timezone: string; year_label: string | null;
  brand_color: string | null; logo_url: string | null; cover_url: string | null; cover_focus: string | null; theme: { hero?: string; density?: string };
  status: EditionStatus; published_at: string | null; suspended_reason: string | null; is_test: boolean; created_at: string;
};

export type EditionPage = { id: string; edition_id: string; slug: string; nav_label: string; title: string; body: string; position: number; in_nav: boolean; is_home: boolean };
export type EditionVenue = { id: string; organiser_id: string; name: string; address: string | null; lat: number | null; lng: number | null; notes: string | null };
export type EditionSession = {
  id: string; edition_id: string; title: string; description: string | null; starts_at: string; ends_at: string | null; venue_id: string | null;
  kind: SessionKind; ticket_mode: "none" | "external"; ticket_url: string | null; price_text: string | null; status: "scheduled" | "cancelled" | "changed"; position: number;
  image_url?: string | null; presenters?: string | null;
};
export type EditionUpdate = { id: string; edition_id: string; title: string; body: string; pinned: boolean; published_at: string | null; image_url?: string | null };
export type EditionSponsor = { id: string; edition_id: string; name: string; level: string | null; logo_url: string | null; url: string | null; position: number };
export type EditionEntitlement = {
  id: string; organiser_id: string; edition_id: string; feature: string; starts_at: string; ends_at: string; source: string;
  amount_pence: number | null; reason: string | null; voided_at: string | null; void_reason: string | null; created_at: string;
};

export const KIND_LABEL: Record<EditionKind, string> = {
  single_day: "Single day", multi_day: "Multi-day", week: "Week-long", season: "Season", campaign: "Campaign",
};
export const ROLE_LABEL: Record<OrgRole, string> = { owner: "Owner", admin: "Administrator", editor: "Editor" };
export const SESSION_KIND_LABEL: Record<SessionKind, string> = { event: "Event", activity: "Activity", session: "Session", exhibition: "Exhibition", tour: "Tour" };

/** Organiser columns a MEMBER or any signed-in reader may select (the database grants exactly these; internal columns are admin-only through functions). */
export const ORGANISER_COLUMNS = "id, slug, name, tagline, description, logo_url, cover_url, cover_focus, brand_color, website, status, verified_at, is_test, hub_id, created_at";
/** Organiser columns for PUBLIC pages (signed-out visitors may not read contact_email). */
export const ORGANISER_PUBLIC_COLUMNS = "id, slug, name, tagline, description, logo_url, cover_url, cover_focus, brand_color, website, status, verified_at, is_test, hub_id, created_at";
export const VENUE_PUBLIC_COLUMNS = "id, organiser_id, name, address, lat, lng, created_at";
export const UPDATE_PUBLIC_COLUMNS = "id, edition_id, title, body, pinned, published_at, image_url, created_at, updated_at";
/** Columns of edition_updates a signed-in team member may read (author ids are not readable). */
export const UPDATE_MANAGE_COLUMNS = UPDATE_PUBLIC_COLUMNS;
export const EDITION_COLUMNS = "id, organiser_id, series_id, slug, title, summary, description, kind, starts_on, ends_on, timezone, year_label, brand_color, logo_url, cover_url, cover_focus, theme, status, published_at, suspended_reason, is_test, created_at";
