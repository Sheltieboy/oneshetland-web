# Admin analytics audit (read-only, 8 Nov 2026)

Scope: WEB worktree `oneshetland-web-admin-intel` (= live main), BE worktree `oneshetland-be-admin-intel`, app `oneshetland-delivers` (reference only). Nothing was run against production; everything below is from source. Items I could not confirm from source are marked UNVERIFIED.

## 1. Summary

- There is one first-party spine: `analytics_events` (append-only) plus a registry `analytics_event_defs`, written by the `log_events(jsonb)` RPC (web, app, `/go` redirect), by the service role (edge functions) and by DB triggers on ledger tables. Reads are admin-only via two RPCs (`analytics_overview`, `analytics_revenue`), `analytics_top_searches`, and an owner RPC `business_analytics`.
- GA4 (`G-93SK16QP7V`) is separate: page views only, loaded after the same consent flag, and it is not queryable from the admin.
- The only analytics admin page is `/admin/analytics` (one page, no chart library, hand-rolled bars). The other admin pages are work queues, not metrics.
- IMPORTANT: the accuracy rewrite (`20261130000000_analytics_phase0_accuracy.sql`) is header-marked "LOCAL: not applied anywhere". The web page already handles both shapes (optional fields in `AnalyticsOverview`). Live production still runs the original `20260628150000` RPCs (raw events, no internal/test exclusion, revenue includes wallet float, fewer streams). Confirm what is applied before building on it (UNVERIFIED).
- Most of the dashboard's "business" metrics can be built today from core tables (profiles, local_businesses, claims, ledgers, jobs, notification_log, email_log, job_sync_runs, cron health RPC) with no new tracking. Engagement depth (funnels, retention, onboarding, notification opens) needs instrumentation.

## 2. What is measured (analytics spine)

Migrations (all in `supabase/migrations/`):

| Migration | Contents |
|---|---|
| `20260628120000_analytics_spine.sql` | `analytics_event_defs` (PK `event_name`; `is_conversion`, `category`, `description`, `created_at`; RLS select `using(true)`), `analytics_events`, `analytics_scrub_pii(text)` (immutable SQL; scrubs email/phone), `log_events(jsonb)`, `business_has_analytics(uuid)`, add-on key `analytics` in `business_addons` + seed trigger `tg_seed_business_addons` |
| `20260628130000` | `tg_analytics_stamp` BEFORE INSERT trigger: overwrites `is_conversion` and `category` from the registry on every insert path (unknown event => false/null) |
| `20260628140000` | `analytics_emit(...)` (SECURITY DEFINER) + AFTER triggers on ledgers: `event_ticket_orders` (status->paid), `book_unit_purchases` (insert), `book_bookings` (insert/update: confirmed, deposit paid), `book_gifts` (->sent), `hub_donations` (insert), `hub_members` (insert), `local_wallet_transactions` (topup/spend), `delivery_requests` (->captured), `local_boost_purchases` (->succeeded), `shifts` (boosted_until changed) |
| `20260628150000` | `is_admin()`, `analytics_overview(p_days int default 30)`, `analytics_revenue(p_days int default 30)`, `analytics_top_searches(p_days int default 30, p_limit int default 25)` |
| `20260628160000` | `business_analytics(p_business_id uuid, p_days int default 30)` |
| `20260628170000` | `business_has_analytics` redefined (wallet add-on expiry via `config->>'paid_until'`), `admin_config` key `analytics.addon_price_pence` |
| `20260801120000`, `20260801140000` | register `social_link_clicked` (referral, non-conversion) and `product_order_paid` (category `sales`) |
| `20261130000000` (LOCAL ONLY) | `analytics_internal_users()`, `analytics_classified_events(from,to)`, replaces `analytics_overview` / `analytics_revenue` (same names/keys plus additive keys) |

**`analytics_events` columns:** `id bigint identity PK`, `occurred_at` (client clock), `received_at` (server), `event_name`, `user_id uuid -> profiles ON DELETE SET NULL`, `anon_id text`, `session_id text`, `platform` (`'app'|'web'`, CHECK), `user_type`, `app_version`, `object_type`, `object_id text`, `business_id -> local_businesses`, `hub_id -> hubs`, `order_id uuid` (pointer, no FK), `is_conversion`, `category`, `props jsonb`, `consent boolean`.

**Indexes:** `occurred_at desc`; `(event_name, occurred_at desc)`; partial `(business_id, occurred_at desc)`; partial `(hub_id, occurred_at desc)`; partial conversion `(occurred_at desc)`; `(object_type, object_id)`; partial `(user_id)`. There is no index on `anon_id` or `session_id`, and none on `received_at`.

**RLS:** SELECT only, admin (`profiles.role='admin'` or `is_platform_owner`). No INSERT/UPDATE/DELETE policy, so direct client writes are blocked. Writers are `log_events` (SECURITY DEFINER, `grant execute to anon, authenticated`) and the service role.

**Who can insert:** anyone, including signed-out. `log_events` takes `user_id` from `auth.uid()` (not spoofable), but everything else is client-supplied: `event_name` (any string; unknown names are stored with category NULL), `platform`, `user_type`, `business_id`, `hub_id`, `order_id`, `occurred_at`, `consent`, `props`. There is no rate limit or size cap in the function (the `rate_limits` migration does not mention it; UNVERIFIED for any edge-level limit).

**Stored data / PII:** `user_id` (when signed in and consented), a persistent `anon_id` (localStorage), per-tab `session_id`, `app_version`, and `props` (route, search `query` PII-scrubbed by regex, `results_count`, `method`). No IP or user agent is stored. Search text can still hold names (regex only catches emails/phones). `product_order_paid` (edge function `_shared/fulfilment.ts:518`) puts `total_pence`, `order_id` in `props`, contradicting the no-money rule and bypassing the `order_id` column that the Phase 0 dedup uses.

**Rollups / cron / retention:** none. There is no summary table, no materialised view, no pg_cron job for analytics, and no purge or retention policy (history is unbounded; `purge-rate-limits` and `purge-old-job-applications` are the only purge jobs). `delete-account` and `ON DELETE SET NULL` leave anonymised events behind (UNVERIFIED whether `delete-account` also nulls `anon_id`). `saved_daily_stats` does not exist anywhere in BE or WEB (grep clean).

**Admin gate (DB):** `public.is_admin()` = `profiles.role='admin' OR is_platform_owner`. Admin RPCs are SECURITY DEFINER with `if not is_admin() raise 'admin only'`, revoked from public/anon, granted to `authenticated`. `business_analytics`: owner or admin; "full" block needs the add-on (admins always get it).

## 3. Event catalogue

Registry has ~65 names (spine migration lines 22-85). Emitters actually found:

| Event | Emitted by | Fields | Platform |
|---|---|---|---|
| `screen_viewed` | WEB `AnalyticsProvider` (every route change, unsampled) | `props.route` | web (app: 1 call site) |
| `content_viewed` | WEB `TrackView`: vessel, event, business (x2 pages), hub, job, shift, spik_word. APP: business, hub, job, shift, memory, spik_word, vessel | `object_type/object_id`, `business_id` (business only), `hub_id` (hub only) | both |
| `contact_clicked` | WEB `ContactLink` (business, hub; methods phone/email/website/directions); APP x5 | `props.method` | both |
| `ticket_outbound_clicked` | WEB `TicketLink` (`app/whats-on/[id]`) | `object_type=event` | web |
| `search_performed` | WEB `TrackSearch`: boats, shop, local (directory), site, jobs, spik; APP x4 | `props.section/query/results_count` | both |
| `android_app_prompt_*`, `ios_app_prompt_*` (shown/dismissed/store clicked) | WEB `lib/app-prompt.ts` | `props.route` | web, NOT registered |
| `social_link_clicked` | WEB `app/go/[...slug]/route.ts` via `publicClient().rpc('log_events')` (server-side, bypasses consent; fixed `anon_id='social-redirect'`) | campaign, channel, slug | web |
| `item_saved/item_unsaved` | APP (jobs, da-boats). WEB `SaveButton` calls the My Saved API, not analytics | `object_type job/vessel` | app |
| Client intent/seller events (app only): `game_started/completed`, `hub_membership_started`, `ticket_purchase_started`, `booking_started`, `hub_donation_started`, `delivery_request_created`, `job_applied`, `job_posted`, `shift_applied`, `shift_posted`, `offer_created`, `event_created/published`, `hub_created`, `campaign_published`, `business_created`, `business_claim_submitted`, `loyalty_program_created`, `nfc_tile_requested`, `memory_created`, `spik_*_submitted`, `gift_claimed`, `driver_application_submitted` | APP `track()` | various | app |
| Ledger events: `event_ticket_purchased`, `unit_purchase_completed`, `booking_confirmed/paid`, `gift_purchased`, `hub_donation_completed`, `hub_membership_paid/joined`, `wallet_topup_completed`, `wallet_payment_completed`, `delivery_payment_captured`, `business_boost_purchased`, `shift_boost_purchased` | DB triggers (`analytics_emit`) | `order_id`, business/hub, small props; hard-coded `platform='app'`, `user_type='user'` | stamped 'app' even for web purchases |
| `product_order_paid` | edge `_shared/fulfilment.ts` direct insert | props with pence; `platform='web'` | web |

Registered but with NO emitter found (dead registry entries, UNVERIFIED for dynamic names): `session_started`, `sign_up_completed`, `sign_in_completed`, `filter_applied`, `content_shared`, `cta_clicked`, `business_followed`, `loyalty_stamp_collected`, `offer_redeemed`, `daily_streak_claimed`, `hub_membership_joined` (client side), `business_subscription_upgraded`, `business_claimed`, `driver_approved`, `driver_bank_connected`, `service_listed`. `_shared/analytics.ts logServerEvent` is defined but has zero call sites.

**Consent and GA4.** Web is opt-in: `lib/analytics.ts` drops everything unless `localStorage.os_analytics_consent === "true"`; `ConsentBanner` (Accept/Decline, one banner covering both first-party and GA). App is also opt-in (Settings toggle, no anon id before consent). GA4 (`lib/ga4.ts`, `GoogleAnalytics.tsx`) loads only after consent, `send_page_view:false`, signals/ads off, pathname only. It is independent of the spine and has no admin surface (the numbers live in the GA console). Both mounted inside `HideOnPrivateRoutes` in `app/layout.tsx:114-116`. Exceptions to consent: ledger triggers and edge events (server-trusted, tied to the transaction) and `/go` click counts.

## 4. Existing admin pages

Gate: `app/admin/layout.tsx` calls `requireAdmin()` (`lib/admin-data.server.ts:14`, `adminAccessFor` in `lib/admin-access.ts`: **`profile.role === 'admin'` only**) and `getAdminStats()` for sidebar badges. Pages re-call `requireAdmin()` where they read via server components. Note the mismatch: the DB `is_admin()` also admits `is_platform_owner`; a platform owner without `role='admin'` is blocked by the web gate. Layout is `max-w-6xl`, `force-dynamic`, no client data fetching.

| Page | Shows | Source |
|---|---|---|
| `/admin` | 4 StatCards (users, pending drivers, open requests, active runs), "Needs review" queue grid with counts, Tools grid | `getAdminStats()`: 12 `count` head queries on profiles, driver_profiles, delivery_requests, runs, spik_suggestions, business_claims, business_alert_access, events (hub, unapproved), content_reports, media_assets, vessel_submissions, local_businesses; `eventQueueBadgeCounts()` |
| `/admin/analytics` | 6 KPI cards, activity-by-day bars, conversions by category, content views by type, top events, sales-by-stream table, wallet funds, subscription estimate, top searches, KPI definitions. Fixed 30 days (no range picker) | `analytics_overview(30)`, `analytics_revenue(30)`, `analytics_top_searches(30)` through `lib/analytics-admin.server.ts` (failures swallowed to null/[] with console.error) |
| `/admin/payments` | membership purchases/refunds, boost purchases, wallet liquidity panel, refund reconciliation | `getMembershipPurchases`, `getBoostPurchases` + panels |
| `/admin/operations` | Fetch requests, runs, disputes (filterable) | `getDeliveryRequests/getRuns/getDisputes` |
| `/admin/claims`, `/reports`, `/alerts`, `/spik`, `/vessel-photos`, `/boats`, `/events*`, `/drivers`, `/nfc` | moderation / approval queues | `getBusinessClaims`, `getContentReports`, etc. |
| `/admin/compliance` | consent/verification record search by email | `searchCompliance` |
| `/admin/email` | templates, settings, last 100 `email_log` rows | `email_log(template_key, recipient_email, status, error, sent_at)` |
| `/admin/launch-readiness` | static launch checklist | `lib/launch-readiness-data.ts` (hand-edited TypeScript, not live data), exposed via `getLaunchReadiness()` which re-checks admin |
| `/admin/launch-partners`, `/launch-testing`, `/homepage`, `/social`, `/notices`, `/config`, `/regions`, `/almanac`, `/activities`, `/accessibility` | curation and config tools | various admin RPCs (`admin_list_launch_plans`, `admin_homepage_exclusions`, ...) |

Shared components: `components/admin/AdminUI.tsx` exports `AdminHeader`, `StatCard({label,value,alert,display,hint})`, `Card`, `Empty`, `StatusPill(tone)`; `AdminSidebar.tsx` holds the grouped `NAV` array (groups Overview/Fetch/Community/Content/Platform) with `badgeKey` counts. Formatting helpers: `lib/analytics-format.ts` (`gbp`, `num`, `salesTotals`, `streamNet`, `isWalletFloat`, `KPI_DEFINITIONS`, `excludedTotal`). Existing test: `tests/analytics-dashboard.test.mjs`.

**Charts:** none. No chart dependency in `package.json` (Next 16.3.8, React 19.2.4, Tailwind 4). The analytics page draws divs with percentage heights (day bars) and widths (event bars). A dashboard needs either more hand-rolled SVG/CSS (consistent with the codebase, no bundle cost) or an added library.

**Styling tokens** (`app/globals.css` `@theme`): `navy #032f4c`, `teal`, `cream`, `sand`, `paper`, `line`, `ink / ink-soft / ink-muted / ink-faint`, plus section colours (`events`, `local`, `jobs`, `shifts`, `hubs`, `fetch`...). Cards are `rounded-card border border-line bg-paper shadow-soft`; the active nav pill is `bg-rose-600`. Dark mode: none seen in admin.

**Mobile:** grids use `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`; tables use `overflow-x-auto min-w-[36rem]`. On small screens the full sidebar stacks above the content (`aside mb-6`, no collapse), so a phone user scrolls past ~30 nav links first. Day bars have only `title` tooltips (no touch access).

## 5. Reusable source tables per metric (no new tracking)

Column lists come from the baseline migration `20260623000000_baseline_remote_schema.sql` plus later migrations noted. They were read without applying later ALTERs, so re-check before coding (UNVERIFIED for added columns).

| Area | Table: key columns | Supports |
|---|---|---|
| Members | `profiles`: `id, role, created_at, updated_at, is_active, email_verified, location_area, has_payment_method, push_token, is_platform_owner`; `auth.users` (`created_at, email_confirmed_at, last_sign_in_at`) via SECURITY DEFINER only; `push_tokens(user_id, platform, last_seen_at)` | sign-ups/day, confirmed rate, WAU/MAU proxy (last_sign_in_at), push reach, by-role, by-area |
| Businesses | `local_businesses`: `is_claimed, claimed_at, is_verified, is_active, subscription_tier, subscription_until, stripe_subscription_id, category, source, created_at, description, logo_url, cover_url, phone, website, email, opening_hours, accepts_wallet, accepts_bookings, payout_enabled, nfc_status, owner_id`; `business_claims(status, created_at, reviewed_at)`; `business_addons(addon_key, enabled, config)`; `local_business_follows(user_id, business_id)` | claimed vs unclaimed, profile completeness score, tier mix, claim backlog age and time to decision, add-on adoption, followers (aggregate) |
| Commerce | `event_ticket_orders`, `product_orders`, `book_unit_purchases`, `book_bookings`, `book_gifts`, `hub_donations`, `hub_members(last_payment_pence, paid_until)`, `local_wallet_transactions(type, amount_pence, platform_fee_pence, cashback_pence)`, `delivery_requests(payment_status, total_fee_pence)`, `local_boost_purchases(refunded_pence)`, `shift_boost_purchases` | already summed by `analytics_revenue`; extend with refunds, AOV, repeat buyers, take rate |
| Subscriptions | `local_businesses.stripe_subscription_id + subscription_tier + subscription_until + subscription_cancel_at_period_end`; est MRR hard-coded 1200/2900 pence in the RPC | paying vs complimentary, churn risk (`cancel_at_period_end`, expiring `subscription_until`). No invoice table found (UNVERIFIED) |
| Jobs / shifts | `jobs(posted_at, expires_at, status, is_hidden, source fields, views_count, application_count)`, `job_applications(applied_at, status)`, `shifts(start_at, status, positions_total, positions_filled, boosted_until)`, `shift_applications`; `job_sync_runs(ran_at, source, ok, reason, parsed, removed, duration_ms)` | live/expiring jobs, applications per job, fill rate, council-sync health (30-day retained) |
| Events | `events` (calendar_approved, organiser fields), `event_submissions(status, created_at)` (`admin_event_submission_counts()` gives pending/changes_requested/oldest_pending_at), `event_ticket_orders` | upcoming event supply, pending queue ageing, winter gap |
| Offers | `local_offers(is_active, valid_until, redemption_count)`, `local_offer_redemptions(offer_id, user_id, redeemed_at)`, loyalty tx `local_loyalty_transactions` | active offers, redemptions |
| Hubs / notices | `hubs`, `hub_members(joined_at)`, `notices(published_at, expires_at, is_hidden, severity)` | hub growth, notice freshness |
| Saved | `saved_items(user_id,item_type,item_id,created_at)` (My Saved migration `20261230110000`, NOT APPLIED; RLS owner-only; admins cannot read; no stats table) | aggregate only via a new SECURITY DEFINER count function |
| Comms | `notification_log(user_id, category, title, status, error, created_at, read_at)` (read_at added by the notifications spine), `email_log(template_key, status sent/delivered/bounced/failed/skipped, error_message, sent_at)` | delivery failures, bounce rate, notification read rate, in-app opens |
| Moderation | `content_reports(status, reviewed_at, created_at)`, `business_claims`, `media_assets.approval_status`, `vessel_submissions`, `spik_suggestions`, `business_alert_access` | queue sizes and oldest item (counts already in `getAdminStats`) |
| Social | `social_posts(status, scheduled_for, posted_at, error, entity_type)` + `social_link_clicked` events | publisher failures, post-to-click |
| Platform health | `cron_job_health()` (columns incl. `job_name, active, schedule, tolerance_minutes, minutes_since_last_run, has_ever_run, recent_failures, healthy`), `cron_transport_health()`, `metering_backlog_health()`; none are called from web or admin (grep clean, UNVERIFIED if monitored elsewhere) | job stalled alerts, metering backlog |
| Config | `admin_config(key,value,category)` | thresholds, daily markers, internal user list (`analytics.internal_user_ids`) |

## 6. Reliability problems

1. **Internal/test contamination in live RPCs.** Original RPCs count admins, tests and fixtures. The fix is local-only (`internal_users` = admins, platform owner, names starting `zz`, staff/test email domains, optional config list). `discovery_fixtures` (3 ids: ZZ TEST business, Anderson & Co demo, ZZ TEST hub) only hides from public discovery; analytics does not reference it, so events with those `business_id`/`hub_id` still count. Add them to the exclusion.
2. **Spoofable ingest.** `log_events` is open to `anon` with no limits, so anyone can inflate views/contacts on a business (those feed the paid seller dashboard) or send `user_type='admin'` (which Phase 0 treats as internal, so it can also hide events). `consent` is client-set and never filtered at read.
3. **Platform field.** Triggers stamp `platform='app'` for every ledger event, including web purchases, so platform splits of conversions are wrong. Web `user_type` is always `'visitor'` (`identifyAnalytics` is never called in WEB). `product_order_paid` is written by hand with `platform:'web'`, and has `order_id` only in props.
4. **Double counting.** `content_viewed` has no dedupe (reloads, back/forward, `screen_viewed` fires on every route change, no sampling despite the registry label "sampled"); the business page has two TrackView mounts (`directory/[id]`, `PublishedBusinessPage`). Ledger triggers re-emit on status toggles; Phase 0 dedupes by (event, order_id) only for local fix. `hub_members` AFTER INSERT only; `book_unit_purchases` counts at insert (assumes paid).
5. **Bots.** No UA filter or bot detection; consent gating removes most crawlers because they do not accept the banner, so web traffic is understated rather than inflated. Social redirect uses a constant `anon_id`, so unique visitors for it are 1.
6. **Time.** `by_day` uses `date_trunc('day', occurred_at)::date` in the DB session timezone (UTC), not Europe/London, and `occurred_at` is the client clock (skewable) rather than `received_at`. Windows are `now() - N days`, not calendar London days. The reminder-runner already has London-day logic to copy.
7. **Identity.** `unique_visitors` counts anon ids, which are per browser and reset on storage clear; signed-in users count by `user_id`. Anonymous history is not stitched to the account except by the Phase 0 exclusion of anon ids that later signed in. Events with null `user_id` are the majority of web traffic (consent-only, anonymous).
8. **Estimates presented as numbers.** Subscription MRR is hard-coded (1200/2900 pence) and counts by plan state; hub membership revenue uses `last_payment_pence` at join date only (renewals not captured); booking deposits have refunds ignored (0).
9. **Search privacy.** Queries are stored lower-cased with regex scrub only; `analytics_top_searches` still reads raw events (no internal exclusion even after Phase 0).

## 7. Missing tracking

Not instrumented (no emitter found): job apply start/complete on WEB (APP has `job_applied` only), shift interactions on WEB, WEB `shift_applied`, onboarding steps / profile completion, sign-in and sign-up events (`sign_up_completed` is registered but unfired; signups come from `auth.users`), notification receive/open (`notification_log.read_at` exists for the in-app inbox only; push opens untracked), My Saved saves/unsaves on WEB (and no stats), follows (`business_followed` registered, never fired), offer views/redeems from client (ledger exists), errors/crash and checkout failures/abandonment (only `*_started` intents in app), zero-result searches on WEB (results_count is sent; admin shows `zero_result`), share, filters, performance/latency, referral source (UTM only on `/go` destination, not captured on landing), retention cohorts (no `session_started`), page-level dwell. The web has no checkout-start events (`ticket_purchase_started`, `booking_started` are app-only).

## 8. Efficiency and history

- All RPCs compute on demand from raw events; no rollups. `analytics_overview` runs ~6 aggregates over the same window; Phase 0 version materialises `analytics_classified_events` once per call, but `internal_anon` scans **all** internal-user events (no date bound) and the `ledger_ok` `EXISTS` checks run per row across 10 ledger tables. Fine at launch volume; will degrade with growth and 365-day ranges (max allowed by `least(p_days,365)`).
- No retention: history goes back to the first consented event (spine date 28 Jun 2026 migration; real data volume UNVERIFIED). Historical reporting is possible but uncapped growth is unmanaged. The Phase 0 header says no analytics history is deleted.
- `occurred_at` index supports windows; distinct counts on `anon_id`/`session_id` have no index (full window scan).
- Recommendation: a `analytics_daily` rollup (London date, platform, event_name, object_type, business_id, count, distinct users approximated) filled by an nightly pg_cron job using the `canonical_scheduled_jobs` + `cron_job_health` expected list pattern.

## 9. Reusable infrastructure for Useful Actions and digest

- **Queue counts:** `getAdminStats()` and `eventQueueBadgeCounts()` already give pending drivers/events/claims/alerts/spik/reports/photos/boats/NFC; `admin_event_submission_counts()` adds the oldest pending timestamp. `/admin` QUEUES table (`key, href, label, desc`) is a ready "needs attention" renderer; `StatCard alert` and `StatusPill` exist.
- **Health signals:** `cron_job_health()`, `cron_transport_health()`, `metering_backlog_health()`, `job_sync_runs`, `email_log.status`, `notification_log.status/error`, `social_posts.status/error`, refund reconciliation panel. None yet surfaced as alerts.
- **Config pattern:** `admin_config` for thresholds and daily "done" markers (used by reminder-runner `markDone`); recommendations should be computed from rules in code (no AI).
- **Static checklist:** `lib/launch-readiness-data.ts` is the only existing "todo" mechanism and is manually maintained; it is a model for rule metadata (id, severity, owner) not a data source.
- **Daily delivery:** `reminder-runner` (pg_cron `*/5`, pg_net, `x-cron-secret` in Vault) already runs once-a-day digests keyed on the London date with `deliver(...)` and an `admin_config` marker (`last_daily_wird_date`); an admin digest can be a similar block calling `send-email` (Postmark-backed, writes `email_log`) or `sendUserPush` to admin ids. No admin digest exists today.

## 10. Recommended build plan

Order:
1. **Land and verify Phase 0 accuracy migration** (apply with an explicit decision; the page is already tolerant). Add `discovery_fixtures`/ZZ exclusions; switch `analytics_top_searches` to classified events; London-day bucketing; use `received_at` or clamp client skew.
2. **Dashboard shell**: a new `/admin/intelligence` (or split `/admin/analytics`) page with a range picker (7/30/90), sections and a "data quality" strip; add a nav entry in `AdminSidebar` NAV and a mobile-collapsible nav; reuse `AdminUI`; write 2-3 small hand-rolled SVG components (sparkline, bar, funnel). Align the gate: one helper for web and DB (`role='admin' OR is_platform_owner`).
3. **One aggregate RPC per section** (SECURITY DEFINER, `is_admin()` gate, `search_path` pinned, revoked from anon): `admin_intel_overview`, `_members`, `_businesses`, `_content`, `_commercial`, `_health`, each returning one JSONB with the same internal-user exclusion. Add rollup table later if latency becomes an issue.
4. **Useful Actions** as a pure TS rule engine over those JSON outputs plus `getAdminStats` (each rule: id, severity, count, link, text), no new tables at first; optional `admin_action_snooze` later.
5. **Digest** as a reminder-runner block (once per London day, admin-only recipients).
6. **Instrumentation backlog** (see section 7): web sign-in/up, checkout start, job/shift apply, notification open, follow, saves, errors; call `identifyAnalytics`; fix ledger `platform`.

Feasible NOW from existing data (no new tracking):
- **Executive:** sign-ups and confirmed rate (auth.users), active members proxy (last_sign_in_at), gross/net sales and platform fees by stream, MRR estimate, queue sizes.
- **Member engagement:** new members by day/role/area, push reach, notification read rate, events by type (content_viewed, search_performed, contact_clicked), zero-result searches. Funnel/retention limited by instrumentation.
- **Business intelligence:** claimed vs unclaimed, tier mix, profile completeness, claims backlog ageing, add-on uptake, followers, per-business views/contacts (consented only), stale/never-updated listings.
- **Content/service performance:** top viewed objects by type, jobs live/expiring/applications, events upcoming and pending queue, offers redeemed, shifts fill, social post/click.
- **Commercial:** all ledger streams, refunds, wallet float vs sales, boost sales, subscriptions at risk (`cancel_at_period_end`, `subscription_until`).
- **Platform health:** `cron_job_health`, `metering_backlog_health`, `job_sync_runs`, email failures/bounces, notification failures, social publisher errors, reconciliation.

Needs instrumentation: onboarding funnel, checkout abandonment, job/shift apply funnels on web, session/retention cohorts, push opens, saves usage, error rates, referral source.
