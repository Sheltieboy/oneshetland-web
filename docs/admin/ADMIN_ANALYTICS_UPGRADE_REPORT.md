# Admin Intelligence Dashboard and Useful Actions: build report

**Date:** 8 November 2026. **Status:** built and tested LOCALLY. Nothing applied to production, nothing pushed, nothing deployed.
Companion document: `docs/admin/ADMIN_ANALYTICS_AUDIT.md` (what existed before, with file references).

## 1. What was built

A new **Admin Intelligence** area at `/admin/intelligence`, and a **Useful Actions** panel on the main `/admin` dashboard directly after a new key-performance summary. Both are admin-only, read through two new database functions, and work on a phone.

### New dashboards and reports (`/admin/intelligence?view=…&days=7|30|90`)

| Report | Answers | Main contents |
|---|---|---|
| **Overview** | Is OneShetland growing? | 8 KPI cards with previous-period trend; Useful Actions (top 3, "show more", history); new members per day; tracked daily/weekly/monthly active people, returning people, stickiness |
| **Members** | What do members do? | Members, new, signed in, push-enabled; registrations chart; content views by type with trend; contact clicks, searches, job applications, offer redemptions; web vs app split; **My Saved aggregate** (members using it, repeat users, saves, by type) |
| **Businesses** | What are businesses doing? | Active, claimed, unclaimed; claim queue (sent, approved, rejected, waiting); free vs paid; top categories; listing completeness (description, logo, cover, contact, hours); what businesses publish (events, offers, jobs, 60-day publishers) |
| **Content** | Which services have traction? | Upcoming and next-14-day events, by category and by area; regular activities; jobs (open, new, closing, expired-but-open, applications); shifts (open, fill rate); hubs (active, publishing); notices by category; offers (active, expiring, redemptions) |
| **Commercial** | How is money developing? | Paid plans by tier, ending soon, free-to-paid pool and ratio; **gross, refunded and net sales** and orders from the existing payment ledgers; estimated subscription revenue (labelled "at list price") |
| **Health** | What needs attention? | Queues (claims, submissions, reports), email failures, push errors, council jobs sync status, analytics freshness |

Every page shows when it was updated and when the last analytics event arrived, has a collapsible **"How these figures are measured"** (definitions) and **"Not measured yet"** list. A failed or missing database read shows "not available", never zeros.

### Useful Actions (rules-based, no AI, no external service)

17 rules evaluated against live data when the page loads. Each card shows **what to do, why (the evidence), expected benefit, priority, category, evidence quality (measured / partial) and a direct link**. Controls: **Mark done, Snooze 7 days, Dismiss**; completed and dismissed items go to a **History** with before/after values and an "improved / not improved" verdict.

| Rule | Evidence | Priority |
|---|---|---|
| Business claims awaiting approval | measured | urgent if oldest over 3 days, else high |
| Member event submissions pending | measured | urgent if oldest over 2 days, else high |
| Open content reports | measured | urgent if oldest over 1 day, else high |
| Council jobs sync failed or overdue (8h) | measured | urgent |
| Analytics events have stopped arriving (3 days) | measured | high |
| Paid plans past their end date (possible billing sync problem) | measured | high |
| Failed or bounced emails (7 days) | measured | high from 5, else medium |
| Push notification errors (7 days, from 5) | measured | medium |
| Incomplete claimed listings (samples named) | measured | medium |
| Thin event coverage next 14 days (threshold 8, a judgement call) | measured | high under 3, else medium |
| Jobs open past their expiry | measured | medium |
| Quiet Hubs (nothing published in 60 days; samples named) | measured | medium |
| Event categories with views but little supply | **partial** (consented traffic only) | medium |
| Paid plans cancelling within 14 days | measured | medium |
| Free businesses worth a paid-plan conversation | **partial** (heuristic: complete and recently publishing) | low |
| Offers ending within 7 days; many unclaimed listings (25+) | measured | low |

**Behaviour:** done hides an action until the measured value gets worse than when it was marked done; dismiss hides until it is 25% and at least 3 worse; snooze hides for 7 days. This stops the same suggestion repeating without new evidence. Urgent operational items rank above growth and commercial ideas. A rule that has no data (for example no sync runs at all) stays quiet rather than guessing. All decisions are written to an audit log.

## 2. Database changes (prepared, NOT applied)

`supabase/migrations/20261231000000_admin_intelligence.sql` (backend branch `admin-intel-be`). Purely additive:
- Tables: `admin_action_state`, `admin_action_log` (RLS on, no policies, all client privileges revoked).
- Functions: `admin_intel_overview(days)`, `admin_useful_actions()`, `admin_action_set_state(key, status, days)` (all `is_admin()`-gated, granted to `authenticated`, not `anon`); internal `admin_intel_rules_raw()` and `admin_intel_rule()` (no client grants).
- No existing table, column, policy, function or data is changed.
- Rollback: `supabase/rollbacks/20261231000000_admin_intelligence.rollback.sql`.

**Privacy design:** results are aggregates or public business/hub names. No member id, email or name is returned anywhere (asserted by a test that searches the whole output). My Saved is counts only. Analytics-based figures exclude administrator accounts and count only people who accepted analytics.

## 3. Tracking: what was and was not added

**No new event instrumentation was added.** Everything uses data that already exists. Reasons and recommendations:

| Gap | Why not added now | Recommendation |
|---|---|---|
| Onboarding completion and drop-off | `sign_up_completed` is registered but never sent; adding journey tracking needs a consent/privacy decision | Decide the consent wording, then emit `sign_up_completed` and one event per onboarding step. Keep it disabled until approved. |
| Job apply started / completed, shift interactions | Not emitted today | Add `job_apply_started` / `job_apply_completed`; the existing `job_applications` table already gives completed counts without tracking |
| Notification opens | Not tracked | Needs a per-notification token or deep-link param; privacy review first |
| Subscription upgrades, downgrades, churn history | Schema keeps only the current tier | Add an append-only `business_subscription_events` table written by the Stripe webhook. This touches payment code, so it was deliberately not done. |
| Listing "last updated" / stale listings | `local_businesses` has no `updated_at` | Add the column with a trigger, then a "not updated in 12 months" rule |
| Per-listing profile views in the overview | Needs per-business aggregation; the existing `business_analytics` RPC does it per business | Add a top-listings table later |

**Existing analytics problems found (not changed here):** `log_events` accepts client-supplied fields with no rate limit; the old `by_day` buckets are UTC (the new reports use UK days); web `user_type` is always "visitor". See the audit. *(Correction: an earlier version of this report said migration `20261130000000` was not applied. It is applied in production, so the older Analytics page already excludes internal and test traffic.)*

## 4. Tests

| Suite | Result |
|---|---|
| Backend isolated, `admin-intelligence.node.test.ts`: 31 tests on a throwaway Postgres rebuilt from all 296 migrations (the replay itself must be clean): admin-only access for anon / non-admin / no-identity on every function; tables unreachable from clients; exact counts from seeded data; fixtures excluded; period comparison; London-day signups; My Saved aggregates (jobs counted from `saved_jobs`); each rule's priority, evidence label and sample names; done / dismiss / snooze / reopen behaviour and re-surfacing only on new evidence; improvement direction for lower-is-better and higher-is-better rules; no member id, email or name anywhere in the output; migration is additive | **31 / 31 pass** |
| Backend regression: `analytics-phase0.node.test.ts` | 14 / 14 pass |
| Web unit and wiring, `tests/admin-intelligence.test.mjs` (22 tests: trend maths with zero handling, formatting, filter validation, admin guard on page and action, no service-role use, input validation, placement of Useful Actions after the KPI summary and before the queues, touch targets, sideways-scrolling tabs, freshness and "not measured" disclosure) | **22 / 22 pass** |
| Web regression: existing `analytics-dashboard`, `launch-admin-guards`, `nav-join`, `fetch-admin-contact` tests | 57 / 57 pass (including the new ones) |
| `tsc --noEmit` | clean |
| Production build (`next build --webpack`) | first run **compiled successfully**; the build then stopped at type-check only because a stale temporary preview route's generated types were still cached. A re-run could not complete because the sandbox could not download Google Fonts (`next/font` network error, unrelated to this change). Re-run `next build` on a normal connection before release. |
| Browser (real Chrome pane, fixture data rendered through the real components, because a signed-in admin session against a local backend was not available): all six reports render at desktop and 375px mobile; no horizontal scroll; action buttons 44px; no console errors | pass |

**Not verified:** the full signed-in flow in a browser against a real database (page reached through `requireAdmin`, then Mark done / Snooze / Dismiss round-trip). The database side of those actions is covered by the isolated tests; the web side is covered by wiring tests and by type-checking. Treat the first run after deployment as the final check (section 6).

Screenshots: `docs/admin/screenshots/intelligence-overview-desktop.jpg` and `intelligence-overview-mobile.jpg` (fixture data).

## 5. Git

| Repo | Branch | Commits |
|---|---|---|
| Backend `/Users/darrenfullerton/Claude/oneshetland-be-admin-intel` (from `my-saved-be` f6c459b) | `admin-intel-be` | `f4d4401`, `1ba441b` |
| Web `/Users/darrenfullerton/Claude/oneshetland-web-admin-intel` (from live `origin/main` 5729f2d) | `admin-intel-web` | see `git log` (one commit) |

Nothing pushed or merged. The existing `my-saved` and other worktrees were not touched.

**Web files:** `app/admin/intelligence/page.tsx`, `app/admin/intelligence/actions.ts`, `app/admin/page.tsx` (KPI summary and Useful Actions inserted; existing queues and tools kept; the old four stat cards kept as "Operations snapshot"), `components/admin/{IntelUI,IntelViews,UsefulActions,AdminSidebar}.tsx`, `lib/admin-intel.ts`, `lib/admin-intel.server.ts`, `tests/admin-intelligence.test.mjs`, `docs/admin/*`.
**Backend files:** the migration, its rollback, `supabase/tests/admin-intelligence.node.test.ts`, `scripts/isolated-pg.mjs` (suite registered).

## 6. Deployment and rollback plan (needs your go-ahead; nothing here has been run)

Order matters: **database first, then web.** The web pages degrade safely if the database part is missing (they show "not available"), so the reverse order is also harmless.

1. **Pre-flight (read-only):** `supabase migration list --linked` (expect only `20261231000000` to be new) and `supabase db push --dry-run --skip-vault`. Note the backend branch is based on `my-saved-be`, which is not yet merged; the dry run must list exactly one migration.
2. **Apply the migration** from the backend worktree: `supabase db push --skip-vault --project-ref nkrtmakxygkvxuxriiil` (run it yourself; the CLI blocks hosted changes from an agent). Avoid :15–:20 past 00/03/06/09/12/15/18/21 UTC (council sync). Additive only; nothing visible changes.
3. **Read-only post-check:** the two tables exist with RLS on; `anon` cannot execute the three functions; a non-admin signed-in user gets `42501`.
4. **Re-run `next build`** on a normal connection, then push `admin-intel-web` to `main` (fast-forward from `5729f2d`; Netlify builds in ~2 minutes).
5. **First-run check as admin:** open `/admin` (KPI summary and Useful Actions present), `/admin/intelligence` (all six tabs, 7/30/90), mark one action Snoozed and then Reopen it, and confirm a non-admin account is redirected away.

**Rollback:** web: Netlify "Publish deploy" on the previous build, or `git revert`. Database: run the rollback file, then `supabase migration repair --status reverted 20261231000000`. Nothing else depends on the new objects.

**Performance note:** the overview runs on demand for admins only (not on member page views). It reads existing tables with simple aggregates and filters analytics by the indexed `occurred_at`. At current volumes this is cheap; if `analytics_events` grows large, add a daily summary table (the functions are the only place to change).

## 7. Things needing your input

1. **Apply order and timing** (section 6), and a sign-off to apply the migration.
2. **Consent/privacy decision** before adding onboarding and notification-open tracking (section 3).
3. ~~Apply the analytics accuracy migration~~ Not needed: `20261130000000` is already applied (verified).
4. **Thresholds are judgement calls** and easy to change in `admin_intel_rules_raw()`: event coverage (8 in 14 days), notification errors (5), unclaimed listings (25), claim ageing (3 days).
5. **Possible follow-ups** (not built): a daily email or push digest of the top actions (reuse `reminder-runner`'s once-a-day pattern); per-listing view counts; subscription event history.
