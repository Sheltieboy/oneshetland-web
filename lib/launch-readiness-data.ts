/**
 * launch-readiness-data.ts — THE source of truth for /admin/launch-readiness.
 *
 * ── Update convention ────────────────────────────────────────────────────────
 * When a development task materially changes launch readiness, update this
 * file IN THE SAME TASK. Change only data here — never the dashboard component:
 *
 *   • status        complete | needs_verification | in_progress | blocked | not_started
 *   • evidence      what proves it (commit, test, physical check) or what is missing
 *   • criticality   launch_blocker | important | nice_to_have
 *   • nextAction    the single next step, or delete it when complete
 *   • lastUpdated   today's date, YYYY-MM-DD
 *
 * Rules:
 *   • "complete" means physically accepted where acceptance applies — code that
 *     exists but has not been exercised end to end is needs_verification.
 *   • Never reuse or rename an id. Add new items with new ids.
 *   • Genuinely post-launch work gets scope: "post_launch" (excluded from the %).
 *   • Unconfirmed state is written as such in the evidence, not guessed.
 *
 * Server-only by convention: import this ONLY from lib/launch-readiness.server.ts.
 * A test fails if anything else imports it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ReadinessDataset } from "./launch-readiness.ts";

export const LAUNCH_READINESS: ReadinessDataset = {
  categories: [
    { id: "core", title: "Core product & accounts" },
    { id: "business", title: "Businesses & directory" },
    { id: "events", title: "Events & ticketing" },
    { id: "payments", title: "Payments & payouts" },
    { id: "commerce", title: "Wallet & commerce" },
    { id: "mobile", title: "Mobile app" },
    { id: "web", title: "Web" },
    { id: "notifications", title: "Notifications & email" },
    { id: "compliance", title: "Privacy, compliance & security" },
    { id: "content", title: "Content & data readiness" },
    { id: "operations", title: "Operations & support" },
    { id: "launch", title: "Launch & marketing" },
  ],

  items: [
    /* ── Core product & accounts ─────────────────────────────────────────── */
    {
      id: "core-signup-signin", area: "core", title: "Account creation & sign-in",
      description: "Email sign-up with confirmation, sign-in, password reset on web and mobile, behind Cloudflare Turnstile.",
      status: "complete", criticality: "launch_blocker", weight: 8,
      evidence: "Turnstile on sign-up/sign-in/resend (web ad8a5df, a796eda; mobile 0bea81c). Cross-device confirmation and 18+/Terms consent (121ff04). Invisible-when-unneeded Turnstile and policy fix (web bfd1b45, 04a8183, 17 Sep).",
      lastUpdated: "2026-09-17",
    },
    {
      id: "core-ios-auth", area: "core", title: "iOS sign-in first-attempt reliability",
      description: "Fresh-install sign-in on iOS 27 without a spinner hang or a failed first attempt.",
      status: "complete", criticality: "launch_blocker", weight: 6,
      evidence: "Active-state gate before openAuthSessionAsync (839d65a) shipped in the combined OTA group cd9f3bba-cfa2-4897-97b2-c8ab314121c8, iOS update 01a0bf95-88d4-7ad9-96d9-b0f248dd495d, runtime 990f08a7c1d07b8a1ad10a6cb1ac00edfa74fd06 on TestFlight build 144. Physically accepted: verification sheet opened on the first attempt, no red verification error, sign-in completed.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "core-password-toggle", area: "core", title: "Password visibility control",
      description: "Show/hide password on mobile sign-in.",
      status: "complete", criticality: "nice_to_have", weight: 1,
      evidence: "Mobile 64f8a7c, shipped in OTA group cd9f3bba. Physically accepted on the real iOS app: hidden by default, eye reveals and re-hides, editing works in both states, value unchanged, sign-in still succeeds.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "core-session-restore", area: "core", title: "Session restoration",
      description: "A signed-in user stays signed in across app restarts and web visits.",
      status: "complete", criticality: "important", weight: 3,
      evidence: "SecureStore session migration verified in the 19 Aug audit; session restore observed in 20 Sep production telemetry. Web session refresh runs in proxy.ts.",
      lastUpdated: "2026-09-20",
    },
    {
      id: "core-onboarding", area: "core", title: "Onboarding",
      description: "Mandatory mobile onboarding with Shetland area picker and sign-out escape.",
      status: "complete", criticality: "important", weight: 3,
      evidence: "Mobile onboarding wizard (eef7ab2), sign-out from onboarding (d2480ae), area picker fixes and search (8a37655, fb42c48), 15 Sep.",
      lastUpdated: "2026-09-15",
    },
    {
      id: "core-admin-access", area: "core", title: "Admin access",
      description: "Only genuine platform admins reach admin tooling; admin cannot be self-granted.",
      status: "complete", criticality: "launch_blocker", weight: 3,
      evidence: "role and is_platform_owner locked by tg_profiles_lock_sensitive (20260818210000). Production has exactly one admin (verified 20 Sep). Web guard requireAdmin() on the whole /admin tree.",
      lastUpdated: "2026-09-20",
    },

    /* ── Businesses & directory ──────────────────────────────────────────── */
    {
      id: "business-directory-data", area: "business", title: "Directory data",
      description: "Business listings imported, de-duplicated and presentable.",
      status: "needs_verification", criticality: "important", weight: 3,
      evidence: "AUDITED 3 Oct 2026 against all 534 production rows, with a 24-business public-evidence sample and a sweep of 60 live pages. COVERAGE: 534 listings (518 public after this audit, 16 hidden), 533 unclaimed by design; every one has a category and an address; 395 have map coordinates, 149 a phone, 93 a website (17%), 105 opening hours, 136 a description, 134 a logo. Real coverage across tourism 155, services 136, retail 93, food and drink 72, accommodation 43, other 35. Sparse contact data is expected for an OpenStreetMap and Living Lerwick import and is what claiming and corrections exist to improve. DUPLICATES: deterministic checks (exact and normalised name, phone, website domain, place id) plus fuzzy-name and 50 m proximity passes; about 2% were the same business listed twice, almost all one shop imported from two sources; 11 clear duplicates were retired (hidden, never deleted, with their missing phone or description copied to the surviving record), 5 legitimately separate look-alikes were kept (two brochs 28 km apart, Peerie Shop and its cafe, group companies sharing a phone, two businesses in one building). CLOSED OR STALE: no listing is confirmed closed; every website was checked: 75 of 90 load, 4 block bots, 3 present invalid certificates (left, the sites may still trade), and 6 domains no longer exist at all (two resolvers, four with no registration); those 6 dead links were removed. OPENING HOURS: structurally clean (0 malformed, impossible, zero-length or conflicting values); 95 of 105 are the documented all-day rule for open-access outdoor sites (brochs, viewpoints, lighthouses, parks); shops, cafes and museums are deliberately left blank rather than guessed, which the app presents as check opening times. SAMPLE (24, stratified across 6 categories, 16 OpenStreetMap and 8 Living Lerwick, random seed fixed): 17 confirmed real and trading from public sources, 0 confirmed closed, 7 not verifiable by search (not evidence of closure), 1 wrong phone (a bakery carrying the Spar's number, removed), 4 clear category errors and 1 name typo (fixed); the sample does not prove every listing is right and does not claim to. PRESENTATION DEFECTS FOUND AND FIXED in production (198 rows, all recorded with a tested revert in supabase/data-fixes): 45 descriptions showed raw HTML entities to visitors (children&rsquo;s clothes); 140 addresses read 'Main Street Shetland, Shetland'; both now clean; 60 of 60 live pages sampled render correctly with matching headings, no raw values and working phone links. REMAINING GATE: public test fixtures. 'ZZ TEST - OneShetland Acceptance Fixture' (Premium, with two public test passes and a test service) and the 'Anderson & Co' CSV seed record (the DEMO gift and pass fixture, which duplicates the real Anderson & Co) are visible in the directory and search. They cannot be hidden today without stranding the pending Wallet healthy-state acceptance, which buys the ZZ pass, and the pass lists do not join to the business, so hiding the listing alone would leave the passes public with no business name. They are retired together with the other ZZ fixtures (hub, campaign, events, passes) tracked in content-test-fixtures. ORDINARY MAINTENANCE, not blockers: 7 unverified sample entries, two OSM duplicates of different parts of Funzie Girt kept, three sites with certificate errors, lighthouses carrying the all-day rule, 314 listings with only a general 'Shetland' address.",
      nextAction: "After the Wallet healthy-state acceptance, retire the ZZ TEST fixture business (id 52f68630), its passes and test service together with the other ZZ fixtures, and hide or retire the 'Anderson & Co' CSV seed record (id 8e3ff71c) with its DEMO gift and pass; then mark Complete. Every other check has passed.",
      lastUpdated: "2026-10-03",
    },
    {
      id: "business-claiming", area: "business", title: "Business claiming",
      description: "An owner can claim an existing listing and an admin can approve it.",
      status: "complete", criticality: "important", weight: 4,
      evidence: "COMPLETE 3 Oct 2026. THE FLOW: a visitor on an unclaimed listing (web, app) taps Claim, signs in if needed and is returned to the claim, submits a pending claim with contact details and evidence; admins are alerted and see a queue with a pending badge on web (/admin/claims) and in the app; approval runs the admin-only approve_business_claim function, which makes the claimant the verified owner, stamps the decider and time, auto-rejects rival pending claims and cannot be applied twice; the claimant is told the outcome (admin-only notice, which opens their business on the shipped app build, where the owner has a Manage business button); the new owner can then manage the listing and a stranger cannot. EVIDENCE: that whole sequence was executed against the real function, policies and triggers in a throwaway database (28 tests), including a rival claim, a double approval, a non-admin trying to approve, and the owner-versus-stranger edit rights; production holds two real approved claims (13 Jul, 2 Sep) with the reviewer recorded, one with the claimant's evidence text, each followed by the approval notice, and a production claim journey earlier found and fixed the double-claim entry; live listing pages offer the claim, and the claim page sends a signed-out visitor to sign in and back. The two claimed listings were later reset to unclaimed for launch (the intended starting state: 533 of 534 unclaimed), so no claimed real listing remains to demonstrate the last hop; that hop is proved by the owner policies instead. DEFECTS FOUND AND FIXED 3 Oct, all applied to production and proved there inside rolled-back transactions as a real signed-in user: (1) the claimant's policy was FOR ALL, so after submitting a claim they could change it (swap the listing between the admin reading it and approving it, so the admin approves a different business than they were shown), mark it approved, forge the reviewer, or delete it; claimants may now only submit a pending claim and read their own. (2) One free account could queue unlimited claims and bury the admin queue and alerts; capped at five waiting claims per person, a decision frees a slot, with a plain message. (3) Rejections recorded no reviewer (web) or no time and reviewer (app); the database now records who decided and when for every decision, for both clients with no app update. (4) The web admin reject button said 'rejected' and notified the claimant even when the write failed; it now reports the error and only notifies after success (deployed with the web push). The app's own claim submission and both web and app admin actions were checked to keep working under the tighter rules. 12 source-level contract tests guard what clients may do to a claim. OBSERVATIONS, not blockers: approving does not check whether the listing is already claimed (an admin decision, deliberately); evidence is free text with no upload; a fresh click-through of the web or app claim form is optional now that the submission payloads of both clients are proved against the live rule.",
      lastUpdated: "2026-10-03",
    },
    {
      id: "business-dashboard", area: "business", title: "Business dashboard",
      description: "Web and mobile business home, status cards and refresh behaviour.",
      status: "complete", criticality: "important", weight: 4,
      evidence: "Business Home (web 89b69c1), dashboard event/payout status fixes (aa5ebcc), focus-refresh behaviour on mobile dashboards (18 Sep checkpoint 04386b4) with tests.",
      lastUpdated: "2026-09-18",
    },
    {
      id: "business-commercial-terms", area: "business", title: "Commercial Terms parity",
      description: "Businesses accept Commercial Terms before selling, enforced identically on web and mobile.",
      status: "complete", criticality: "launch_blocker", weight: 4,
      evidence: "Terms acceptance, UX and enforcement suites (commercial-terms-*.node.test.ts); web cd2d3b7, 560aa72.",
      lastUpdated: "2026-09-18",
    },
    {
      id: "business-capabilities", area: "business", title: "Business capability management",
      description: "Adding capabilities (events, products, passes, bookings, Wallet) with tier entitlements.",
      status: "complete", criticality: "important", weight: 3,
      evidence: "Add-capability chooser and tier-entitlement suites for bookings, products, passes, Wallet, offers/loyalty.",
      lastUpdated: "2026-09-11",
    },

    /* ── Events & ticketing ──────────────────────────────────────────────── */
    {
      id: "events-creation", area: "events", title: "Event creation",
      description: "Create an event with ticket types, including per-order maximum.",
      status: "complete", criticality: "launch_blocker", weight: 4,
      evidence: "Event create per-order max and ticket-type save suites; web and mobile.",
      lastUpdated: "2026-09-17",
    },
    {
      id: "events-management-index", area: "events", title: "Events management index",
      description: "One place to see and manage a business's events.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "web c1dd017, mobile 1b38a5e (18 Sep); events-management-index suite.",
      lastUpdated: "2026-09-18",
    },
    {
      id: "events-pricing-parity", area: "events", title: "Event pricing parity",
      description: "Free, paid and mixed free+paid events labelled identically on web and mobile.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "Free ticket labelling (b600b2c) and mixed free+paid handling (04a650b), 17 Sep; event-price-label suites.",
      lastUpdated: "2026-09-17",
    },
    {
      id: "events-free-tickets", area: "events", title: "Free tickets",
      description: "A free ticket can be claimed and appears in the buyer's tickets.",
      status: "complete", criticality: "launch_blocker", weight: 4,
      evidence: "Free-ticket acceptance completed (reported by Darren, Sep 2026).",
      lastUpdated: "2026-09-18",
    },
    {
      id: "events-paid-publishing", area: "events", title: "Paid-ticket publishing",
      description: "Draft/publish UX for paid events, gated on payout readiness.",
      status: "complete", criticality: "launch_blocker", weight: 5,
      evidence: "Publish-gate UX (a4ab502, 75ab4dc). ZZ TEST paid event successfully published after Stripe onboarding (physical, Sep 2026).",
      lastUpdated: "2026-09-18",
    },
    {
      id: "events-capacity-limits", area: "events", title: "Ticket capacity & per-order limits",
      description: "Sold-out and per-order caps enforced by the database, not only the UI.",
      status: "complete", criticality: "launch_blocker", weight: 4,
      evidence: "reserve_ticket_slots FOR UPDATE (audit-verified); capacity/order-max and selector-max suites; manage capacity card (web 0593153).",
      lastUpdated: "2026-09-18",
    },
    {
      id: "events-qr-tickets", area: "events", title: "QR tickets",
      description: "Each ticket has a scannable QR with a backup code.",
      status: "complete", criticality: "launch_blocker", weight: 4,
      evidence: "QR generation and fallback (mobile-ticket-qr-fallback suite); physical acceptance completed.",
      lastUpdated: "2026-09-18",
    },
    {
      id: "events-scanning", area: "events", title: "Scanning & check-in",
      description: "Door scanning with re-scan protection and live check-in.",
      status: "complete", criticality: "launch_blocker", weight: 4,
      evidence: "Scanner RPCs locked to service role (ea7d4ab); atomic redemption (20260820120000) stops double-scan; live check-in suite. Re-scan protection physically accepted.",
      lastUpdated: "2026-09-18",
    },
    {
      id: "events-paid-purchase", area: "events", title: "Paid-ticket purchase acceptance (£1)",
      description: "A real buyer completes a £1 paid ticket purchase end to end in test mode.",
      status: "complete", criticality: "launch_blocker", weight: 8,
      evidence: "Verified 25 Sep (read-only; DB plus Stripe read server-side, masked). Order abcc7c92 for 'ZZ TEST \u2014 Payout Gate Test': status paid 00:16:12 UTC, \u00a31.96 (\u00a31.00 face + 96p fee), one PaymentIntent pi_3UJ\u2026jgQM succeeded amount_received 196 gbp; 1 PaymentIntent for the order (search by metadata order_id); the 5 earlier attempts are all cancelled with cancelled tickets and never charged. Exactly one ticket valid (490a6084), 0 pending_payment; events.tickets_sold=1 and ticket type quantity_sold=1 (incremented once); webhooks payment_intent.succeeded and transfer.created each received once, status processed, attempts 1, no error. Organiser list and detail read 1 sold, 0 checked in, 0 pending (same data; not rendered). Ticket untouched: not scanned, checked_in_at null.",
      lastUpdated: "2026-09-25",
    },
    {
      id: "events-post-payment", area: "events", title: "Order, ticket & payout after payment",
      description: "After a paid purchase: order paid, ticket valid and scannable, payment and transfer visible in Stripe.",
      status: "complete", criticality: "launch_blocker", weight: 6,
      evidence: "PHYSICALLY ACCEPTED 25 Sep, full paid-event flow on 'ZZ TEST — Payout Gate Test'. Paid order verified: £1.96 (£1.00 + 96p fee), one PaymentIntent succeeded, no duplicate order or PaymentIntent, five earlier abandoned orders cancelled and uncharged. Ticket issued: exactly one valid ticket per paid order with a validation hash; QR/code verified by the real scans below. Inventory incremented once per paid order (sold read 1 after the first purchase, on both organiser queries; data-level check). Destination charge verified in Stripe: platform-account charge, 96p application fee, £1.00 net to the organiser's canonical connected account, transfer not reversed. Webhooks payment_intent.succeeded and transfer.created processed once. First scan succeeded on mobile: valid → used, audit trail one 'valid' check-in. Second scan refused as already_used (two refusals recorded on the first ticket), no duplicate check-in for any ticket (live-checked). Attendee celebration verified after a backgrounded scan on a fresh ticket (mobile 4695440, OTA ee23314f): 'You're in!' shown once on return, ticket settled to used, no replay on reopen. NOTE for the record: during acceptance two orders (abcc7c92, 245bd018) were later refunded and a third order paid for the retest. By documented policy a refund voids valid tickets but never returns capacity, so the lifetime counter events.tickets_sold / quantity_sold reads 3 while the scanner stats count 2 valid/used tickets; an already-used ticket (490a6084) stays used under a refunded order. Not a defect against this acceptance, but the organiser list and detail 'sold' figures can differ after refunds.",
      lastUpdated: "2026-09-25",
    },
    {
      id: "events-ticket-ownership-display", area: "events", title: "'Your ticket' shown only for genuinely issued tickets",
      description: "Personalised strips and cards mark an event as owned only when the buyer holds a valid or used ticket — never for a pending, cancelled, refunded or abandoned checkout.",
      status: "complete", criticality: "launch_blocker", weight: 4,
      evidence: "ACCEPTED 25 Sep. Original defect: pending_payment, cancelled and refunded ticket rows could trigger 'YOUR TICKET' (web For You read event_tickets by holder_id with no status filter). Systemic fix deployed (web 66090e6): ownership is limited to valid and used via one shared OWNED_TICKET_STATUSES rule used by For You and My Tickets. Negative case, automated: run as each test account under production row-level security through the exact deployed filters in a rolled-back transaction, an account with a cancelled, a refunded and an expired-pending ticket and no owned ticket got 3 historical rows, 0 For You cards and 0 My Tickets (the old rule would have shown 1 false card); an account with cancelled + valid for one event got exactly 1; historical non-owned rows remain in the database without creating entitlement. Positive case, physical production check: genuine used tickets still correctly show YOUR TICKET and appear in My Tickets. Scope note: the rendered negative case (fixture account bd6276f0) was verified at the data layer, not by a separate browser check; the fixture rows (one cancelled, one refunded, marked ZZ) remain on the ZZ acceptance event.",
      lastUpdated: "2026-09-25",
    },

    /* ── Payments & payouts ──────────────────────────────────────────────── */
    {
      id: "payments-stripe-onboarding", area: "payments", title: "Stripe Connect onboarding",
      description: "Businesses start payout onboarding from the action that needs it, with loading feedback.",
      status: "complete", criticality: "launch_blocker", weight: 5,
      evidence: "Contextual launch (4a0431b), launch feedback (26149f3), 18 Sep. Physically completed for ZZ TEST in test mode.",
      lastUpdated: "2026-09-18",
    },
    {
      id: "payments-payout-resolver", area: "payments", title: "Canonical payout readiness",
      description: "One resolver, business_payout_ready(), used by server and both clients; merchant status parity.",
      status: "complete", criticality: "launch_blocker", weight: 5,
      evidence: "Canonical resolver (web 2587d16), server consolidation and status parity suites (18 Sep checkpoint 8128f56).",
      lastUpdated: "2026-09-18",
    },
    {
      id: "payments-activation-gates", area: "payments", title: "Paid activation gates",
      description: "Paid events, products, passes and Wallet cannot go live without payout readiness.",
      status: "complete", criticality: "launch_blocker", weight: 4,
      evidence: "d57178a (17–18 Sep); payout-activation-gate suite.",
      lastUpdated: "2026-09-18",
    },
    {
      id: "payments-stripe-resilience", area: "payments", title: "Stripe loading & rate-limit resilience",
      description: "Stripe onboarding survives slow loads and 429s without a dead end.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "0414d89 / 36d9ead (18 Sep); payout-loading-feedback and payout-rate-limit-resilience suites.",
      lastUpdated: "2026-09-18",
    },
    {
      id: "payments-saved-card-event", area: "payments", title: "Saved-card resolution for event checkout",
      description: "Ticket checkout uses the buyer's canonical default card, or says clearly why it can't.",
      status: "complete", criticality: "launch_blocker", weight: 5,
      evidence: "Verified 25 Sep against the completed \u00a31.96 payment: the PaymentIntent's customer equals the buyer's canonical bound Stripe customer, and its payment method (Mastercard \u2022\u2022\u2022\u2022 3990, card) belongs to that same customer; no setup_future_usage, so an existing saved card was used rather than a card newly entered. Created by the deployed create-event-ticket-intent through the canonical resolver. Earlier attempts before the rebind and reconcile never reached a charge.",
      lastUpdated: "2026-09-25",
    },
    {
      id: "payments-saved-card-rebind", area: "payments", title: "Saved-card state consistent across Account and checkout",
      description: "has_payment_method can never be true without a canonical usable customer/card, and Account shows the same answer as checkout.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "24 Sep. Root cause: the flag was a cache, true for 4 profiles with no Stripe customer, and Account/Payments read the flag while checkout resolved the card canonically. Server: reconcile-saved-cards deployed (cron-secret gated, dry-run first); real run checked 6 profiles: 2 already consistent, 1 recovered (a provably-owned customer bound through the canonical claim/settle path, card attached), 3 flags correctly cleared (no provable customer, nothing created). Production now has 0 profiles flagged without a bound customer; guard trigger trg_profiles_card_flag_needs_customer and nightly job reconcile-saved-cards are live. 35 tests pass incl. live invariant checks. Web Account/Payments and mobile Account/Me now read the saved-card-state resolver (brand + last4 only). Re-verified 25 Sep ~00:07 UTC: reconciler dry run against live Stripe checked 3 → 3 consistent, 0 to recover, 0 to clear (every flagged profile has a bound customer with 1 card); 0 profiles flagged without a bound customer; trigger enabled; nightly job active (first run 03:25 UTC 25 Sep); reconcile-saved-cards v2, saved-card-state v1 live; web 6ba6518 on main (no display reads the flag); mobile OTA 694aef52 is the current production update on runtime 990f08a7. 213 saved-card tests pass (8 suites, live parts included). Migration 20261016000000 is live but not recorded in schema_migrations (idempotent). PHYSICALLY VERIFIED 29 Sep: the same OneShetland account checked on web and mobile shows the same saved card — Mastercard ending 3990 — on both platforms. Web Payments & banking shows the card 'On file'; mobile shows 'Payment card added'. No stale or mismatched saved-card state is visible on either. Bank/payout account state remains correctly separate and unconnected (not conflated with the card). This closes the one thing left open: Account and checkout genuinely agree, on both platforms, for a real account.",
      lastUpdated: "2026-09-29",
    },
    {
      id: "payments-saved-card-other-flows", area: "payments", title: "Saved-card consistency in gift, unit and top-up",
      description: "Every charge path picks the default card the same way.",
      status: "not_started", criticality: "important", weight: 2,
      evidence: "Gift, unit-purchase and Wallet top-up still take the first card rather than the default (audit-only on 24 Sep).",
      lastUpdated: "2026-09-24",
    },
    {
      id: "payments-destination-charges", area: "payments", title: "Destination-charge routing",
      description: "Ticket money reaches the business's connected account, platform fee retained.",
      status: "complete", criticality: "launch_blocker", weight: 4,
      evidence: "Proven in Stripe 25 Sep on the real \u00a31.96 charge: PaymentIntent retrieved with the platform key and no Stripe-Account header (platform-account destination charge); transfer_data.destination equals the event's canonical payout account (event_payout_destination); application_fee_amount 96 matches the order's platform_fee_pence and the application-fee object (96, not refunded); transfer to the destination succeeded, not reversed; the destination account's payment is \u00a31.96 gross with 96p fee, net \u00a31.00 to the organiser. Charge paid, not refunded.",
      lastUpdated: "2026-09-25",
    },
    {
      id: "payments-webhook-fulfilment", area: "payments", title: "Webhook fulfilment & idempotency",
      description: "Payments are fulfilled even if the client never confirms; repeats are no-ops.",
      status: "complete", criticality: "important", weight: 3,
      evidence: "Launch checklist Phase 1 done 29 Jul; webhook HMAC + 5-minute window verified in the 19 Aug audit.",
      lastUpdated: "2026-07-29",
    },
    {
      id: "payments-live-cutover", area: "payments", title: "Stripe live-mode cutover",
      description: "Live keys, live prices, live webhook, Supabase secrets and live publishable key on web and app.",
      status: "complete", criticality: "launch_blocker", weight: 10,
      evidence: "CONFIRMED LIVE 25 Sep. Physical acceptance: the £1.96 event-ticket purchase moved real money on live Stripe. Independently read from Stripe server-side (masked): the server's Stripe secret is a live key and the PaymentIntents for the acceptance orders report livemode true; the live webhook delivered payment_intent.succeeded and transfer.created, each processed once. The saved card was a real card (Mastercard, not a Stripe test number). Mobile publishable-key mode confirmed LIVE 25 Sep (EAS production environment; the OTAs are built with it, and process env is proven to outrank the local .env, which still holds pk_test). The key baked into the installed build 144 binary and the production WEB publishable key were not separately inspected.",
      lastUpdated: "2026-09-25",
    },
    {
      id: "payments-live-acceptance", area: "payments", title: "Live-mode payment acceptance",
      description: "One real low-value payment through each money path, plus a refund.",
      status: "complete", criticality: "launch_blocker", weight: 6,
      evidence: "PHYSICALLY ACCEPTED 25 Sep on live Stripe for the paid-event money path: successful £1.96 payment, webhook fulfilment, destination charge with 96p application fee, £1.00 net to the organiser's connected account, ticket issued, scanned and checked in, second scan refused. Refunds proven: orders abcc7c92 and 245bd018 are each fully refunded in Stripe (£1.96 charge refunded, amount_refunded 196) and marked refunded in the database, refunded back to the real card by Darren. SCOPE: this covers the event-ticket path. Other money paths (product orders, wallet top-up, boosts, memberships, donations, gifts, Fetch) were not exercised live in this acceptance. NOTE: the third acceptance order 7d4a03a3 (the retest ticket, £1.96) is a live charge that is still NOT refunded.",
      lastUpdated: "2026-09-25",
    },

    /* ── Wallet & commerce ───────────────────────────────────────────────── */
    {
      id: "commerce-local-wallet", area: "commerce", title: "Local Wallet",
      description: "Top-up, pay-at-till charge approval, cancellation and refunds.",
      status: "needs_verification", criticality: "important", weight: 4,
      evidence: "Charge approval recovery and success state (web 5f2de03, 7d9c1db), server-side cancel (20f1382), refunds (b744b1b), with suites. Physical test-mode acceptance not recorded here. NOT COMPLETE — all Wallet MERCHANT-SETTLEMENT rails now use the canonical liquidity gate (code and tests; live-proved on event tickets; the three newest physically accepted in the CRITICAL state on 2 Oct, healthy-state acceptance still to do). 2 Oct 2026: hub donation, hub membership and pass purchase (the wallet-checkout routes) no longer debit the customer before asking whether Stripe can fund the merchant transfer. All four wallet-checkout routes spend through ONE shared helper (settleMerchantWalletPayment) that puts the same gate event tickets and gifts use in front of the debit: read the live liquidity snapshot, fail closed if it cannot be established, apply the reserve floor, atomically reserve the final resolved merchant transfer amount against the single pooled headroom, hold it across debit + transfer, release in finally. The gate is asked for the transfer built from the same object the transfer is made from, so it is always the final resolved amount and destination; the self-payment block, payout resolver and attempt claim still run first. A refusal is BEFORE the debit — no ledger spend, no transfer, no donation/membership/pass row, no compensating refund row — and for a fresh attempt the claim is released so the same reference can be paid once the Wallet is available; a resumed attempt whose money already moved is left untouched and is not told nothing was taken. Customer wording: 'Wallet temporarily unavailable. No money has been taken. Please use another payment method.' (mobile OTA, no longer titled 'Payment failed'). Shift boosts stay explicitly exempt: platform-retained, no merchant transfer. COVERAGE of the gate now: till and scan-to-charge and product orders (executeWalletPayment preflight), event tickets and gifts (withWalletLiquidityGate), and hub donation / hub membership / pass purchase (settleMerchantWalletPayment). The structural audit finds ZERO ungated merchant-settlement routes, restricts which files may call debitAndTransfer, and fails if a new route adds one without the gate. PROOF: 56 tests drive the real wallet-checkout handler, real wallet-ledger, settlement core and gate core against fakes for the database, Stripe and the pool — per rail: Critical refuses before any movement, the same reference then succeeds, exactly one debit and one transfer to the right destination and amount, idempotent under retry and double-tap, an unreadable Stripe fails closed, the reservation is released after success, Stripe rejection and a throwing debit; across rails: donation+membership, pass+event ticket, gift+donation and three at once share one pool and cannot oversubscribe it. Deployed: wallet-checkout v51 byte-identical to source, verify_jwt unchanged. CRITICAL-STATE PHYSICAL ACCEPTANCE PASSED 2 Oct 2026 for hub donation, hub membership and pass purchase (customer darren@oneshetland.com, Wallet £5.00; production fixtures: ZZ TEST — Wallet Acceptance Hub bad36349…, campaign cdea9594… £1.00 donation, plan f9ba98c5… £1.00 once, and ZZ TEST — Wallet Pass 8f6f1332… on the ZZ TEST business, owned by a different user so self-payment is false). Each refusal showed 'Wallet temporarily unavailable — No money has been taken. Please use another payment method.' and the app stayed responsive, offering another payment method. Reconciled read-only against the database and Stripe: NO customer debit or ledger row (balance still £5.00, last ledger row the 14:14 refund, no ledger rows for anyone since 14:30), NO Stripe transfer, refund or PaymentIntent since 16:45 UTC (checked directly in Stripe), NO donation, membership or pass purchase record (campaign £0.00 / 0 supporters, 0 membership purchases, only the hub owner's own automatic row, 0 pass purchases), NO compensating refund or reversal row and NO failed-fulfilment row (no money moved, so none was needed), NO open or stale attempt (every attempt claim created for the gate check was released: 4 claims, 4 releases, 4 rows deleted; zero claims for the customer), NO stranded liquidity reservation (0 held, none left), and the gate was reached each time (reservation requested before any debit; zero debit, transfer-mark or commerce-write calls from the attempts). Liquidity was Critical throughout: Stripe available £4.93 against the £100 reserve, £144.49 pending, monitor state 'critical', funding session still pending_at_stripe. The first attempt exposed a client freeze (alert modal over the confirm-sheet modal on iOS) — fixed by showing failures inside the sheet (mobile 7da9ace, OTA 2 Oct) and re-passed by this physical test. STILL REQUIRED before Complete: HEALTHY-liquidity physical acceptance once the pending £145.07 platform funding transfer is Available at Stripe — a real Wallet donation, membership and pass purchase each succeeding with exactly one debit, one transfer to the right account for the right amount (donation £1.00, membership £1.00 with a 95p fee on a £1.95 debit, pass 95p after a 5p fee) and one record; plus confirming a test-mode top-up and till charge were physically completed.",
      nextAction: "Once the £145.07 is Available at Stripe: (1) one real healthy Wallet donation, membership and pass purchase on the ZZ TEST fixtures, each verified for exactly one debit, one transfer and one record; (2) confirm a test-mode top-up and till charge were physically completed. Critical-state refusal is already physically accepted.",
      lastUpdated: "2026-10-02",
    },
    {
      id: "commerce-products", area: "commerce", title: "Products & basket",
      description: "Buying a business's products through the basket.",
      status: "complete", criticality: "important", weight: 3,
      evidence: "COMPLETE 29 Sep — real end-to-end acceptance on both web and mobile, after the card-selection fix (8d73e46, 7682474) was deployed. Fixture: business 'ZZ TEST — OneShetland Acceptance Fixture', product 'Hamnavoe Lighthouse Print' at £2.00, fulfilment 'Collect from the shop'. Two real live-mode payments made: web order 740B06A3 (PI pi_3UKvn2CCZSiMQBCg01TOPRyH) and mobile order 59F0CFD2 (PI pi_3UKvqOCCZSiMQBCg0kP4IHXW). Manual acceptance walked the full merchant lifecycle on both: Order received → accepted → Being prepared → Ready to collect → Collected/complete, and both appear correctly in the buyer's order history. Verified read-only against the database and Stripe (no further payment made): exactly one product_orders row per ref, correct business/product/qty/£2.00 total/commission, status 'completed'; product_order_items match the product exactly; exactly one stripe_webhook_events row per PI ('payment_intent.succeeded', processed, 1 attempt) — no duplicate webhook effects; exactly one order row per payment_intent_id — no duplicate orders; stock/reserved cycle correctly balanced (reserved back to 0 on both, stock correctly untouched — the product is 'tracked' mode with NULL stock, which commit_product_stock deliberately treats as unlimited, not a bug). Stripe side: both charges succeeded exactly once, not refunded, amount/amount_received/application_fee_amount all match the DB (200p / 10p), transfer destination matches the canonical business_payout_destination-resolved Connect account, transfer not reversed, and the payment method on both was the customer's actual canonical saved card (pm_belongs_to_canonical_customer true, Mastercard •3990 — the same card physically verified for payments-saved-card-rebind), confirming the card-selection fix holds under a real charge. During the mobile acceptance run the tester also found a genuine navigation defect (see below), now fixed and shipped OTA.",
      nextAction: "None — monitor real customer product purchases as volume grows.",
      lastUpdated: "2026-09-29",
    },
    {
      id: "commerce-passes", area: "commerce", title: "Passes & unit purchases",
      description: "Buying and redeeming passes / units.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "COMPLETE 29 Sep — real live purchase and redemption on both platforms, both fixes physically re-tested and confirmed. Real live-mode purchase 052fcacc-e0ff-432d-9e5b-b76c8847d629 (PI pi_3UL0FLCCZSiMQBCg1g6fhV7J, £1.00, 'ZZ - Demo Pass') reconciles exactly against Stripe and the database — livemode true, succeeded once, canonical Mastercard •3990 on the correct Stripe customer, correct payout destination, correct 5% commission, exactly one processed webhook, exactly one redemption, uses_remaining 0 matching fully_used_at to the millisecond, correct stock decrement. redeem_pass_atomic's FOR UPDATE locking plus the isolated concurrency suite (559 tests) prove exactly-once decrement and no double-spend under real concurrency, standing in for a live multi-use purchase. Two real defects were found during this acceptance run, both fixed and both now physically re-confirmed: (1) mobile — Passes & vouchers and business detail not refreshing after a till redemption until pull-to-refresh; fixed with useFocusEffect (OTA 01a0ed36); RE-TESTED: returning from the redemption screen now refreshes automatically, final used state shown correctly, no pull-to-refresh needed. (2) web — customer's 'Use at till' returned 'Can't redeem / Unauthorised'; root-caused (not the reported hypothesis of calling the merchant endpoint directly, which was traced and disproved) to supabase-js's fetchWithAuth falling back to the anon key when auth.getSession() can't produce a live session, a gap latent on both platforms; fixed by checking session freshness first in startRedemption on both web and mobile (web f3c9fa8, mobile OTA 01a0ed49); RE-TESTED: signed in fresh as the customer, opened the active pass, Use at till worked correctly, completed without the Unauthorised error, final state showed Redeemed! and 0 uses left. No change was made to merchant authorization, the redemption token/code mechanism, or either edge function throughout. Tests: pass-redemption-stale-state.node.test.ts (10), redeem-session-freshness.node.test.ts (12), plus unit-purchase-and-redemption, pass-purchase-history, redemption-preview-and-balance, gift-claimed-pass-ux, business-detail-ticket-routing, business-profile-tickets-intent, mobile-entitlement-correctness, wallet-tier-entitlement, redemption-business-scope, loyalty-redemption-atomicity, loyalty-scanner-clarity, passes-tier-entitlement — all pass. Typecheck and lint clean throughout.",
      nextAction: "None — monitor real customer pass purchases as volume grows.",
      lastUpdated: "2026-09-29",
    },
    {
      id: "commerce-bookings", area: "commerce", title: "Bookings & payment status",
      description: "Appointment bookings in Shetland time with correct payment state.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "COMPLETE 30 Sep — real production acceptance covering discovery, creation, cancellation, capacity release, and the full completion lifecycle, plus a booking-specific tier-entitlement audit and fix. Bookings has no online payment yet ('No deposits collected yet — Phase 3 will insert a Stripe PaymentIntent step', confirmed still true in local-book-confirm.tsx and against production: all book_bookings rows have deposit_pence 0 and a null deposit_payment_intent_id) — 'payment state' for this item means the booking's own status lifecycle, not a Stripe charge. Three real bookings on 'ZZ - Test booking' (ZZ TEST — OneShetland Acceptance Fixture, Premium tier), all reconciled read-only against production with no code change needed: (1) dc698133, created then cancelled ~1 minute later — customer cancellation confirmed to propagate to the merchant view. (2) 1fc03f20, starts_at 14:00 UTC = 15:00 Shetland local (BST) — created then cancelled, matching the physical observation exactly once the UTC/local offset is accounted for (Wed 30 Sep: 3 slots/15:00–15:30 FULL before, 4 slots/15:00–15:30 available after) — capacity correctly reopened. (3) 39a7a26c — created, appeared correctly to both customer and merchant, moved from Upcoming to Past once its time passed, merchant's 'Mark complete' correctly withheld until after the start time then used, customer correctly saw Completed. Reconciliation found: no duplicate rows (one row per booking attempt, matching one physical action each), capacity math consistent (capacity 1, only one non-cancelled booking on the service at any point), no anomalous notification pattern (each create/cancel fires notify-booking exactly once, fire-and-forget, confirmed in source), metering correctly protected — claim_bookings_for_metering's own WHERE clause excludes status='cancelled' outright, so the two cancelled bookings' leftover metering_state='pending' can never be claimed or billed regardless of that column's value; the completed booking correctly shows metering_state='skipped' (Premium is marked, not billed, by design). No genuine defect found, so no booking behaviour was changed during this reconciliation. Tier entitlement (same day, separate audit): Bookings confirmed Pro-and-above from three independent sources (TIER_FEATURES.bookable='pro', both live server triggers requiring business_meets_tier(id,'pro'), and bookings-tier-entitlement.node.test.ts's own 'pro'-tier fixture) — isBookableLive() (mobile) and getBookableServices() (web) both wrongly required subscription_tier==='premium' exactly, fixed to the canonical tierUnlocks()/tier-enumeration rule on both platforms; accepts_bookings and is_active left unchanged, still independently required; server-side needed no correction. Service-first discovery rework (Local → real service card → direct booking, no business-detail hop) also verified working end-to-end in this same acceptance pass. Tests: bookings-tier-entitlement (32), book-discovery-tier-entitlement (13), book-service-first-discovery (23), booking-terminal-state, bookings-canonical-time, booking-metering, booking-metering-invocation — all pass. Full isolated concurrency suite (559 tests, including booking-capacity-concurrency) passes. Mobile OTA and web deploys for the discovery/tier work both verified live.",
      nextAction: "None — monitor real bookings as volume grows. Phase 3 (online deposit collection via Stripe) remains a separate, not-yet-built feature, tracked outside this item.",
      lastUpdated: "2026-09-30",
    },
    {
      id: "commerce-gifts", area: "commerce", title: "Gifts",
      description: "Sending, claiming and redeeming gifts.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "COMPLETE 30 Sep — full lifecycle physically verified live for both gift kinds, two real defects found and fixed, both re-tested. AUDIT: traced the complete gift lifecycle (purchase, recipient verification, claim, redemption, expiry, cancellation) across both platforms; confirmed only passes and bookable services are giftable (no product-gift path exists); confirmed the two-factor recipient-identity model (confirmed-email match OR a consumed verification challenge) is robust and fails closed; confirmed claiming is single-use/idempotent (row-locked, re-claim by the same claimant is a no-op); confirmed merchants cannot arbitrarily claim/transfer gifts (claim_gift_by_id delegates entirely to claim_gift, same gift_recipient_ok gate); confirmed unit-gift claims are atomic (purchase row + status flip in one transaction) while booking-gift claims are a two-step claim-then-book, protected instead by enforce_gift_funded_booking's advisory-locked one-live-booking-per-gift guard. Both production gifts found at audit time predated this session's ZZ TEST work and were Stripe test-mode (no real money). DEFECT 1 — create-gift-intent used the raw first-card Stripe lookup instead of the canonical chargeableCardFor() resolver already used by products/events/boosts/hub-donations/hub-memberships/unit-purchases; fixed, reconciling the file's separate already-live business_payout_destination drift rather than overwriting it; deployed and downloaded source diffed byte-identical. DEFECT 2 — booking-gift status relied on a client-side UPDATE after createBooking() that book_gifts' SELECT-only RLS silently no-opped every time (confirmed live: gift abb19ac7 had a real, fully-reconciled gift-funded booking against it and had sat at status='claimed' since 24 Aug); replaced with sync_gift_status_with_booking, a server-side trigger atomic with the booking write in the same transaction, which also reverts 'used' back to 'claimed' on cancellation so enforce_gift_funded_booking's own documented rebooking rule is genuinely true. Proved in a scoped isolated Postgres cluster (35 tests: gift-claim-concurrency + gift-funded-booking-status-sync) before going anywhere near production. Migration ledger reconciled first — four older migrations (places-search rate limits, saved-card-flag-requires-customer, close-anon-fail-open-rpcs, booking-meter-status-owner-only) were independently confirmed already fully live in production (byte-identical function/trigger definitions, matching grants, matching rows) despite showing unrecorded in the ledger; repaired via migration history repair rather than re-executed, then the new migration pushed on its own — confirmed via pg_get_functiondef and trigger listings that nothing else changed and enforce_gift_funded_booking was untouched. PHYSICAL ACCEPTANCE (ZZ TEST fixture, both gift kinds, real Stripe charges): unit/pass gift purchased from darren.fullerton@gmail.com to darren@darrenfullerton.com — wrong-account claim correctly refused with a clear verify/switch-account instruction, correct-account claim succeeded, gifted pass appeared correctly; booking gift purchased and claimed the same way, then booked, cancelled, and rebooked — production reconciliation of the resulting rows confirms the full cycle genuinely happened: booking f39c04c2 (created 15:35, cancelled 15:38), a second cycle ca5c378e (created 15:53, cancelled 16:29), and the final live booking dce4dce1 (created 16:39:02, still confirmed) — gift f24ac553's status='used' with used_at=16:39:02 matching that booking's creation exactly. Both PaymentIntents (pi_3ULPRv…, pi_3ULPWl…) confirmed livemode true, succeeded, canonical Mastercard •3990, 5% application fee, correct ZZ TEST payout destination (acct_1UH2Sk…, matching business_payout_destination() exactly); exactly one webhook event processed per PI; exactly one book_unit_purchases row (owned by the correct recipient) and no duplicate book_gifts/book_bookings rows anywhere; exactly one local.gift_received email per gift and no duplicate merchant push notifications. This also resolves the discrepancy flagged in an earlier reconciliation pass, where a reported 'rebook → Used' step had no corresponding database row — re-tested for real this time and fully corroborated against production. UX FOLLOW-UP: a recipient whose gift-funded booking was cancelled had no way back into the reopened gift except the original claim email; added a 'Gifts to book' section to My Bookings (both platforms) and tightened the existing For You/home nudge copy, reusing the existing booked-derivation and serviceId/giftId deep link unchanged — no new server code, no change to enforce_gift_funded_booking's ownership/service/business checks regardless of how the gift id reaches the booking screen. Tests: gift-preview-security, gifts-sent-received, gift-recipient-verification, gift-pick-a-time, gift-claimed-pass-ux, gift-claim-concurrency, gift-funded-booking-status-sync (10), gift-to-book-discovery (17), saved-card-flow-parity — all pass. Typecheck clean both repos throughout. RE-RECONCILED 2 Oct against production, read-only (no gifts, payments or bookings created): the in-app reuse path was physically accepted — after cancelling, the gift returned from used to claimed, appeared in the recipient's own OneShetland account, and was rebooked directly in-app with no email link needed. ROWS: four book_gifts in total, no duplicate code or payment_intent_id; the two live gifts (097a6f43 unit, f24ac553 booking) each have purchaser = the gmail account and claimed_by = the confirmed account matching recipient_email, one claimant each, exactly one book_unit_purchases row for the unit gift (owned by the recipient), and f24ac553 has three bookings (two cancelled, one confirmed) with status used and used_at equal to the live booking's creation to the microsecond; the cancelled 09:00 slot has no live booking against it. Booking-gift status matches its lifecycle for every booking gift, including the older abb19ac7; the sync trigger reverts a gift only on cancelled, so a booking moving to completed keeps it used. STRIPE: both live PaymentIntents are livemode true, succeeded, GBP 100, exactly one per gift (the only PIs since 30 Sep), application fee 5p (5%), destination acct_1UH2Sk… equal to business_payout_destination(), transfer 100 not reversed, charge not refunded, one processed webhook event each. The two older gifts predate live mode (their PIs do not exist under the live key). Triggers ae_gift, enforce_gift_funded_booking and sync_gift_status_with_booking enabled.",
      nextAction: "None — monitor real gift purchases as volume grows. Gifts currently have no expiry mechanism populated (expires_at stays null); flagged as a product decision, not a defect, and not yet actioned.",
      lastUpdated: "2026-10-02",
    },

    /* ── Mobile app ──────────────────────────────────────────────────────── */
    {
      id: "mobile-build-144", area: "mobile", title: "TestFlight build 144",
      description: "Current iOS binary, runtime 990f08a7, channel production.",
      status: "complete", criticality: "important", weight: 3,
      evidence: "EAS build af23ec01, submitted 19 Sep, installed via TestFlight.",
      lastUpdated: "2026-09-19",
    },
    {
      id: "mobile-ios27-acceptance", area: "mobile", title: "iOS 27 auth physical acceptance",
      description: "Build 144 signs in on a physical iOS 27 device.",
      status: "complete", criticality: "launch_blocker", weight: 4,
      evidence: "Passed on Darren's iOS 27 iPhone, 20 Sep (retry path; see iOS sign-in first-attempt reliability).",
      lastUpdated: "2026-09-20",
    },
    {
      id: "mobile-ota-runtime", area: "mobile", title: "OTA updates & runtime",
      description: "JS updates reach build 144 without a new binary.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "Two iOS OTAs on 20 Sep verified via served manifest and bundle hash. Trap: any eas.json edit changes the fingerprint and strands 144. UPDATE 29 Sep: third OTA shipped a real defect fix found during commerce-products mobile acceptance testing — on Shop Shetland (and, found to share the same bug, the Directory and Local browse screens), the hero SafeAreaView uses edges={[]} so the header photo runs under the status bar, but the overlay Back pill was positioned with a hardcoded top: 12 instead of the useSafeAreaInsets()-based offset the same header pattern already uses elsewhere (TabScreenHeader's own right slot; get-it-done/plan-day/cruise* back pills) — it rendered under the status bar/notch and was untappable, trapping the user on the screen. Fixed identically in app/shop.tsx, app/local-businesses-browse.tsx and app/local-combined-feed.tsx (top: insets.top + 12); JS-only, no native module touched. Confirmed OTA-safe: fingerprint unchanged (990f08a7c1d07b8a1ad10a6cb1ac00edfa74fd06) before publishing. Committed (aae2d56), typecheck clean, the one existing test suite that reads these files' source (wallet-tier-entitlement, 47 tests) still passes. Published to branch production / platform ios, update group 973cfb01-73a8-4756-b74b-2323b3a5a13e, iOS update 01a0ec36-7ffe-7618-8e75-3681e80bdc39; served manifest fetched live and its expo-update-id header confirmed matching.",
      lastUpdated: "2026-09-29",
    },
    {
      id: "mobile-app-store", area: "mobile", title: "App Store readiness",
      description: "Production submission: listing, screenshots, privacy labels, reviewer account, live Stripe key.",
      status: "needs_verification", criticality: "launch_blocker", weight: 8,
      evidence: "SUBMITTED TO APPLE 28 Sep 2026, 16:04 UTC. Build 1.0.0 (144). App Store Connect status: Waiting for Review. Release method: manual (release only after approval). INDEPENDENTLY RE-VERIFIED 29 Sep via a fresh eas metadata:pull (a live authenticated ASC API read, not just Darren's report): release.automaticRelease is false, confirming manual release; the full listing (description, subtitle, promoText, keywords, marketing/support/privacy URLs) is populated; categories set (Lifestyle, Shopping); the age-rating advisory is fully answered (ageRatingOverrideV2 EIGHTEEN_PLUS, ageAssurance true, userGeneratedContent true — corrected from the earlier default-false pull); copyright is set; Review Information (contact name/phone, the appreview@oneshetland.com demo account, and reviewer notes covering payments/location/account deletion) is filled in; and 8 real screenshots are attached for both the 6.9\" iPhone and 13\" iPad sizes, matching the capture list from the 28 Sep screenshot work. The pulled file was read for verification only, then discarded — the reviewer account's password came back from ASC in that read, was never committed, and the working copy was immediately reverted to the placeholder version already in git. Everything from the 28 Sep App Store audit remains true: build 144 is the correct distribution build, JS-only fixes since then (including this week's saved-card, security and analytics-consent work) reach it via the same production OTA runtime, and no launch-blocking security issue remains. WHAT REMAINS: Apple's review itself — an external dependency, not unfinished OneShetland work. Nothing further is actionable on our side until Apple responds (approval, or feedback to address).",
      nextAction: "Wait for Apple's review decision. If approved: confirm the live listing, then release (manual release is selected, so approval alone does not publish it). If Apple requests changes: address them and resubmit.",
      lastUpdated: "2026-09-29",
    },
    {
      id: "mobile-android", area: "mobile", title: "Android",
      description: "Android build and Play Store listing.",
      status: "not_started", criticality: "important", weight: 3,
      evidence: "No Play listing; recent fixes shipped as iOS-only OTAs. Whether Android is in launch scope is unconfirmed.",
      lastUpdated: "2026-09-24",
    },

    /* ── Web ─────────────────────────────────────────────────────────────── */
    {
      id: "web-production", area: "web", title: "Production deployment",
      description: "oneshetland.com live on Netlify in soft launch.",
      status: "complete", criticality: "launch_blocker", weight: 4,
      evidence: "Live with soft-launch messaging since Aug 2026.",
      lastUpdated: "2026-09-19",
    },
    {
      id: "web-auth", area: "web", title: "Web authentication",
      description: "Sign-up, sign-in, reset and app-originated confirmation on the web.",
      status: "complete", criticality: "launch_blocker", weight: 3,
      evidence: "Turnstile rollout and /auth/confirmed (07ea2db), 15–17 Sep.",
      lastUpdated: "2026-09-17",
    },
    {
      id: "web-checkout", area: "web", title: "Web checkout",
      description: "Basket, tickets and Wallet checkout on the web.",
      status: "in_progress", criticality: "important", weight: 3,
      evidence: "Basket has an explicit saved/new card choice. Ticket modal's 'Pay with' choice written 24 Sep, uncommitted.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "web-admin-tooling", area: "web", title: "Admin tooling",
      description: "Queues, payments/refunds, compliance log, email centre, launch readiness.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "/admin area behind requireAdmin(); this dashboard added 24 Sep.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "web-key-routes", area: "web", title: "Key production routes",
      description: "Home, directory, events, business pages, sitemap, robots and not-found recovery.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "Public surface contract and not-found recovery suites; sitemap and robots in place. SHARED-LINK 404 FIXED AND VERIFIED LIVE 3 Oct 2026 (web d55bb5a): app-minted share URLs /give/<campaignId> and /b/<slug> used to 404 for anyone without the app. Now /give/<id> redirects (307) to /hubs/campaign/<id> and /b/<slug> to /directory/<slug>. Production check: a real campaign id and a real business slug each redirect once and end on HTTP 200; invalid ids/slugs still end on 404; /g/* and /t/* unchanged (200). Guarded by tests/app-link-redirects.test.mjs (5 pass). No mobile, Apple, Wallet or payment code changed.",
      lastUpdated: "2026-10-03",
    },

    {
      id: "mobile-business-universal-link", area: "mobile", title: "Business share link opens the installed app (/b/*)",
      description: "https://oneshetland.com/b/<slug> should open the business profile in the app when it is installed.",
      status: "not_started", criticality: "nice_to_have", weight: 1, scope: "post_launch",
      evidence: "/b/* currently opens the web business page rather than the installed app because it is not yet included in the iOS association file or Android intent filters (association route paths are /t/*, /g/*, /give/*; app.json intentFilters likewise). The web fallback itself works (/b/<slug> redirects to /directory/<slug>, verified live 3 Oct 2026). The mobile app/b/[slug].tsx handler exists but is unreachable by universal link.",
      nextAction: "After the current App Store build is in review/released: add /b/* to the association route and to app.json associatedDomains/intentFilters, then verify on a device with the app installed. Do not change those files while the build is in review.",
      lastUpdated: "2026-10-03",
    },

    /* ── Notifications & email ───────────────────────────────────────────── */
    {
      id: "notifications-centre", area: "notifications", title: "Notification centre",
      description: "In-app and web notification inbox with preferences.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "COMPLETE 3 Oct 2026, verified against production data and executed SQL rather than screenshots. WHAT IT IS: one shared inbox (notification_log) read by the app and by web /notifications; every push attempt leaves a row, including for users with no push token; preferences (15 module switches, master switch, quiet hours) on web /account/notifications and in the app. PRODUCTION DATA: 1,050 visible notifications across 12 users, 0 orphans, 0 duplicates (same user, category, title and body within two minutes), and every row carries routing data; unread count and the list use the same visible statuses (sent, no_token, skipped_quiet), so the badge always matches the list. ROUTING: all 45 distinct payload shapes in production, plus the new refund notices, were run through the real web and app routing functions: every one now opens a screen that exists on both platforms. DEFECTS FOUND AND FIXED: (1) QUIET HOURS SILENTLY ERASED NOTIFICATIONS: a push held back during quiet hours was logged as an opt-out and hidden, so it was neither pushed nor recorded; a database trigger now keeps it in the inbox (skipped_quiet) while a muted module or a master-off user stays a hidden opt-out; applied to production and proved there inside a rolled-back transaction, and it covers every sender with no redeploy. (2) On the web, ticket notices (confirmation, reminder, cancellation and the new refund notices) opened My memberships instead of My tickets; shop-order updates and merchant, employer and cruise notices had no web destination; all corrected, live now. (3) On the web, a failed load said 'Nothing yet' and a failed preference save still said 'Saved'; both now say what happened, and the save is reverted. (4) THE SUBMITTED APP BUILD (iOS 144) COULD NOT OPEN 9 OF THE 45 PAYLOAD SHAPES: its router, unchanged since 7 Aug and reconstructed from the build's own source, has no screen for merchant notices (new booking, booking cancelled, sale, payment received, plan ended) or for 'worker checked in/out', so those taps did nothing, and the employer 'new application' and 'withdrawn' notices opened a screen that does not exist (Not Found). The app-side fixes exist only as unshipped local code, so the requirement is met on the SERVER instead, with no app change, OTA or build: a database trigger gives merchant notices a business_id (build 144 opens the owner's own business page, which has a 'Manage business' button) and only when it is certain (the booking's own business, else the owner's only business; an owner of several is never guessed at), and gives employer notices a fallback; the employer senders (notify-shift-application, notify-shift-status, notify-worker-checkin) now carry the shift_id, which build 144 opens as the shift with its owner hub for managing applicants; stored notices were backfilled. Checked by running every one of the 1,050 stored visible notifications through the build-144 router: 1,023 open a real screen, 0 open Not Found, and 27 have nothing to open (old test notices of an admin account that owns no business; the inbox record is intact). Proved on live inserts inside a rolled-back transaction. The unshipped app code (employer alias, merchant dashboard alias, load-failure message) is now optional polish that makes merchant notices open the dashboard directly. PRIVACY, proved against real row security: users read only their own rows, another user's history by id returns nothing, signed-out sees nothing; clients cannot insert, edit or delete a notification; mark-read and mark-all act on the caller's own rows only and are idempotent; preferences are readable and writable only by their owner; should_notify, which reveals another user's settings, is service-role only (3 Oct) and the senders all use the service role, so mute settings and quiet hours are still honoured. 41 executed-SQL tests and 72 routing, parity, rendering and shipped-build-compatibility tests pass (a guard fails if any sender ever uses a screen the shipped app does not understand); every fix was mutation-proved. OBSERVATIONS, not blockers: quiet hours are compared in Shetland time, so a visitor abroad would see them shifted; no one has set quiet hours in production yet, so the defect was latent; the inbox has no pagination beyond the latest 50 and no per-notification delete, acceptable at launch volume.",
      lastUpdated: "2026-10-03",
    },
    {
      id: "notifications-transactional", area: "notifications", title: "Transactional notifications",
      description: "Ticket receipts, billing emails and push for payments and orders.",
      status: "complete", criticality: "important", weight: 3,
      evidence: "COMPLETE 3 Oct 2026. THE MODEL: every important event leaves a durable in-app record first (order, ticket, booking, Wallet ledger, membership state); the Notification Centre (notification_log) adds an inbox item for every push attempt, including users with no push token, and only opt-outs are hidden; push is the timely extra; email is reserved for receipts that matter outside the app. A push is never the only record. MUST-NOTIFY, all covered: event tickets (email receipt sent from every path that can mark an order paid, idempotent; push on the card flow); event cancelled or updated (email and push); booking created (push to the business), booking cancelled (push to the other party) and 24-hour booking reminders; Wallet top-up, Wallet spend, pass or unit purchase, gift sent, hub donation receipt (push and inbox); shop order accepted, ready, sent, cancelled or refunded (push); business plan change (email) and ended or lapsed (push); failed delivery payment; card refunds of memberships and deliveries. GAP FOUND AND FIXED 3 Oct: three refund routes returned money and told the customer nothing (event-ticket refund by card and by Wallet, merchant Wallet refund, Wallet membership refund). Each now sends one deduplicated notice to the CUSTOMER (never the person who pressed refund) saying the amount and where it went, with the card wording stating 5 to 10 working days, deep-linking to My Tickets or the Wallet using screens the app already routes; deployed server-side only (refund-payment, wallet-refund-business), no app update needed, and a notice failure can never undo or block a refund. DECIDED NOT TO NOTIFY, on purpose: booking confirmation (instant in-app confirmation plus the reminder), Wallet top-up email, ticket push on the free/Wallet/saved-card paths (receipt email already covers it), gift claimed, failed Wallet attempt (the in-sheet error is the message). DORMANT TEMPLATES, left unsent deliberately: booking_confirmed, booking_cancelled, booking_reminder, account.welcome, email_verified, wallet_topup, local.subscription_* (duplicates billing.*), fetch.*, shifts.*, driver_* and business_approved (push already covers), compliance.* data-request notices (handled by the support runbook), platform.newsletter and feature_update (marketing: needs a broadcast stream and unsubscribe), security.* (post-launch hardening). A test locks the exact set of wired emails so nothing is activated by accident. PUSH STATE IN PRODUCTION: Expo push; push_tokens (iOS) holds 4 tokens for 3 users plus 6 legacy profile tokens: 7 of 269 accounts have a usable token, which is expected pre-launch; 464 pushes accepted by Expo with 0 errors; stale tokens are pruned when Expo reports DeviceNotRegistered; preferences and quiet hours are honoured (137 muted sends recorded and hidden); push and email failures are caught and logged, and can never fail a payment, ticket, gift or refund. OWNERSHIP AND LEAKAGE: notification_log has row security with a single SELECT policy on the user's own rows and no client write policy; the inbox RPCs act on auth.uid() only; should_notify (SECURITY DEFINER, took any user id and was callable with the public anon key, revealing another user's mute settings) is now service-role only, and every sender passes a service-role client so the preference check cannot fail open. PHYSICAL EVIDENCE ALREADY OBSERVED: ticket receipt email Delivered and Opened in Postmark; real production sends logged for ticket confirmation, Wallet top-up and spend, charge requests, bookings and cancellations, gifts, donations and payments received during the acceptance runs. 47 tests (real refund handlers and push sender against fakes, plus the coverage table) pass; mutations were caught. OBSERVATION, not a blocker: Expo accepting a push is logged but its later device-delivery receipt is not polled or stored, so on-device receipt of a push has no authoritative record; the Notification Centre is the guarantee. POLISH: poll Expo receipts to prune stale tokens sooner; a member-side receipt for hub membership purchases and a post-deletion confirmation email; security notices (password and email changed) once account-takeover alerting is prioritised; Android tokens belong to mobile-android.",
      lastUpdated: "2026-10-03",
    },
    {
      id: "notifications-email", area: "notifications", title: "Email readiness",
      description: "Verified sender domain, auth templates and a working contact mailbox.",
      status: "complete", criticality: "important", weight: 3,
      evidence: "COMPLETE 3 Oct 2026. PHYSICAL POSTMARK EVIDENCE (operator-checked in the Postmark console): oneshetland.com DKIM Verified and Return-Path Verified; recent production event-ticket emails to a real OneShetland inbox show Delivered and then Opened; 45 emails sent in the last 30 days; 0 spam complaints; 65% open rate on tracked messages. This physically proves an authenticated sending domain, an aligned Return-Path, real production delivery and real recipient opening. OBSERVATION, not a blocker: no numeric bounce-rate figure was visible in the Postmark statistics screen; no evidence of a launch-blocking delivery problem was found (our own email log records 0 failed sends in the last 30 days and 0 bounced; its only 4 failures ever were on 31 Aug, to previously deactivated addresses). IDENTITY: every transactional email is sent From OneShetland <orders@oneshetland.com> through Postmark with Reply-To hello@oneshetland.com, a monitored inbox (operations-support). No personal address is in any sender, any of the 42 templates or the email settings; no dev or placeholder host in any link; all links are https://oneshetland.com. PATHS: password reset, event tickets, event cancellation and updates, gift received and gift verification, business plan changes and shift application decisions are wired; Supabase Auth sends sign-up confirmation (confirmed from up to 50 distinct domains in a week). TEMPLATES: all 42 scanned; none has test wording, a broken link or a stale address. FAILURE ISOLATION (proved by tests running the real code): the shared sender never throws and records every outcome in email_log; every caller is wrapped, so a failed email can never fail a payment, ticket, gift or webhook; the tickets, orders and gifts are the record, not the email. DEFECTS FOUND AND FIXED, ALL DEPLOYED: (1) the password-reset function trusted the caller's redirect_to on an unauthenticated endpoint, so a genuine reset email could carry a victim's single-use recovery token to any site; the link now only ever lands on oneshetland.com/reset-password or www (13 hostile variants tested); the function remains callable by the signed-out forgot-password flow. (2) The email subject was inserted unescaped into the HTML header; now escaped, and the fix is deployed in all 10 functions that bundle the shared sender (confirm-boost, confirm-event-tickets, confirm-gift, create-event-ticket-intent, create-product-order-intent, notify-event-update, request-password-reset, send-email, stripe-webhook, verify-gift-recipient), each verified from its downloaded source, with each function's other files and gateway auth setting left exactly as they were. (3) Hub broadcast emails now set Reply-To hello@ and log every attempt, and a failed email does not affect the hub operation. 46 email tests plus the neighbouring suites (205 tests) pass. POLISH, not blockers: DMARC to p=quarantine with a report address now that DKIM is verified; a Postmark bounce/complaint webhook so bounces appear in the Email centre; hub broadcasts use the transactional stream with no unsubscribe, a decision before hubs email at volume; booking, refund, Wallet top-up and security-notice emails are not wired (tracked under notifications-transactional).",
      lastUpdated: "2026-10-03",
    },
    {
      id: "notifications-noise", area: "notifications", title: "Frequency & noise review",
      description: "No user is spammed by overlapping notifications.",
      status: "not_started", criticality: "nice_to_have", weight: 1,
      evidence: "Not reviewed.",
      lastUpdated: "2026-09-24",
    },

    /* ── Privacy, compliance & security ──────────────────────────────────── */
    {
      id: "compliance-privacy-cookies", area: "compliance", title: "Privacy & cookies",
      description: "Privacy policy and cookie disclosure that match what the browser stores.",
      status: "complete", criticality: "important", weight: 3,
      evidence: "988df9a (29 Aug) including Stripe's cookies; privacy-cookie-disclosure suite.",
      lastUpdated: "2026-08-29",
    },
    {
      id: "compliance-analytics-consent", area: "compliance", title: "Analytics consent",
      description: "Analytics only with consent.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "CORRECTED 28 Sep. Previously marked complete on the strength of the web consent banner alone — the evidence never actually covered mobile, and mobile analytics was in fact opt-OUT by default (DEFAULT_CONSENT=true in lib/analytics.ts), creating and persisting an analytics id on every launch regardless of consent. Found during the Privacy Policy audit, fixed same day: mobile now defaults to off, creates/persists no identifier and queues/transmits nothing until the Settings toggle is explicitly turned on; a stray identifier left on a device by the old build is deleted the next time the app runs. A prior genuine opt-in is preserved exactly (CONSENT_KEY is written only by the toggle, so a stored value can only ever be a real choice). 20 tests (mobile-analytics-consent.node.test.ts), 4 mutation checks, all pass; privacy-cookie-disclosure suite updated and passing. Deployed: mobile-repo commits 124b673 + 8acdd56, iOS OTA group 614c6f84 (runtime 990f08a7, no native build needed — JS-only); web copy corrected in commit 4462faa, verified live.",
      lastUpdated: "2026-09-28",
    },
    {
      id: "compliance-stripe-disclosure", area: "compliance", title: "Stripe disclosure",
      description: "Buyers and sellers are told Stripe processes payments.",
      status: "complete", criticality: "important", weight: 1,
      evidence: "Privacy/cookie disclosure and selling policy (selling-policy suite).",
      lastUpdated: "2026-08-30",
    },
    {
      id: "compliance-legal-review", area: "compliance", title: "Legal review of terms",
      description: "Terms, Privacy and Commercial Terms reviewed before taking real money.",
      status: "not_started", criticality: "important", weight: 3,
      evidence: "Web LAUNCH_CHECKLIST.md asks for a solicitor review. Whether it has happened is unconfirmed.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "compliance-security", area: "compliance", title: "Security tests & audit remediation",
      description: "The 19 Aug audit's launch blockers closed and guarded by tests, re-audited against the live system on 25 Sep.",
      status: "complete", criticality: "launch_blocker", weight: 6,
      evidence: "RE-AUDITED 25 Sep against the LIVE system, not the August notes. Column-lock investigation stays closed (harness fault; the repaired test, delivers 0333065, was re-run against production and passes). Finding by finding: GOOGLE MAPS KEY: STALE. No longer unrestricted — it is HTTP-referrer restricted (calls with no referrer or a foreign referrer are refused, and web-service APIs refuse it). Side effect logged separately (mobile-places-key). F1 booking_meter_status: FIXED NOW. Any signed-in user could read any business's monthly booking counts; now owner, admin or service role only, refused with 42501 otherwise. F3 ai-cover-letter: FIXED NOW. Auth was already real (anon key refused), but there was no cap on paid Anthropic calls and the key is live; now 10 per hour and 30 per day per account, before any spend. F4 notify-hub: FIXED NOW, and it WAS exploitable — any signed-in user could push 'you are now a member' to anyone, or a join request in anyone's name. Now tied to the hub through is_hub_admin / hub_members: join_request only for your own pending request, approved only by an admin of that hub for an active member, membership_paid only from our backend. Matrix tests plus 7 mutation checks; anon key refused live. F5 calculate-fee: FIXED NOW. Raw input went into a postcodes.io URL path (fixed host, so not SSRF); now only a valid UK postcode via the shared validator, encoded, no redirects, 6s timeout, and a 600/min endpoint ceiling. Real postcodes still quote; traversal, query, numbers and 20k-character input get 400. F6 oneshetland-feed: LOW RISK / CLEANUP. No caller anywhere, fixed WordPress URL, no user input, already globally rate limited. F7 SECURITY DEFINER search_path: FIXED NOW for all six (accept_image_pin_suggestion, count_lk_vessels, get_spik_stats, mark_notifications_read, should_notify, unread_notification_count); a live test now requires every SECURITY DEFINER function in public to have one. NEW, found during F7/F8: three anon-callable SECURITY DEFINER functions FAILED OPEN because 'IF owner <> auth.uid()' is NULL for an unauthenticated caller: accept_image_pin_suggestion (proven: anon accepted a suggestion, in a rolled-back transaction), business_analytics (anonymous read of any business's analytics) and accept_alert_policy. FIXED NOW: revoked from public and anon, verified 42501 over HTTP with only the anon key, and a class-wide live test now fails on any anon-callable definer function with that guard shape. F8 should_notify / is_hub_admin: LOW RISK. Both are uuid-keyed oracles (a user's notification preferences; whether a user administers a hub); is_hub_admin must stay executable because RLS policies call it. should_notify is only called server-side but is left executable on purpose: send-push fails OPEN if that RPC errors, so revoking could override users' opt-outs. F9 @expo/ngrok: LOW RISK / CLEANUP. Never imported, so never in a runtime bundle; moved to devDependencies; runtime fingerprint unchanged (990f08a7). STORAGE: all 10 buckets have size and MIME limits and four policies each; no anon or public write policy. TESTS: security-reaudit 34 pass (incl. live rolled-back anon probes); rpc-exposure 17, identity-binding 5, ai-route-security 21, gift-preview-security 34, rate-limits 15, step14-hardening 10 all pass. DEPLOYED: migrations 20261025000000 and 20261025010000 applied; notify-hub, calculate-fee and ai-cover-letter deployed from cec4a5c. Commits db9eb9e, cec4a5c, de08595, 7bb19ca. NOT exercised in production: the authorised positive paths of notify-hub and the ai-cover-letter limiter (no user session by design); they are covered by the unit matrix and the policy rows are verified present. Remaining non-blocking security work is tracked in security-followups. UPDATE 28 Sep: the notify-* caller-authorisation follow-up tracked there (item 7) is now resolved and verified in production too — see security-followups for the full detail. This item's own scope (the 19/25 Sep launch blockers) is unaffected and stays complete.",
      lastUpdated: "2026-09-28",
    },
    {
      id: "mobile-places-key", area: "mobile", title: "Mobile address search Google key",
      description: "Address autocomplete in the app works with a Google key that is safely restricted.",
      status: "complete", criticality: "important", weight: 3,
      evidence: "Physically accepted 27 Sep on production iOS: latest OTA installed, typing 'ZE1 0' in a business address field now returns suggestions. The app calls the places-search Edge Function (mobile 23b91fb, iOS OTA group 37f32126, runtime 990f08a7 — JS-only, no native rebuild), which proxies Places Autocomplete/Details on a server-side Google Places key that never ships in any app bundle. Gated by requireCaller (no-auth and anon-key calls get 401) and a per-account rate limit (180/hour, 800/day); every parameter whitelisted (places-search.node.test.ts, 31 tests). The web's referrer-restricted browser key was not weakened or touched.",
      lastUpdated: "2026-09-27",
    },
    {
      id: "security-followups", area: "compliance", title: "Security follow-ups (non-blocking)",
      description: "Hardening from the 25 Sep re-audit that does not gate launch.",
      status: "not_started", criticality: "nice_to_have", weight: 1, scope: "post_launch",
      evidence: "1) analytics_emit is anon-callable (the non-definer analytics triggers run as the invoking user, so clients need EXECUTE): anyone can insert an analytics row for any user or business, i.e. analytics poisoning, no money or PII. Fix by making the tg_ae_* triggers SECURITY DEFINER, then revoke. 2) should_notify and is_hub_admin are uuid-keyed oracles; revoke should_notify from clients only after send-push fails CLOSED on an RPC error. 3) oneshetland-feed has no callers and can be deleted. 4) calculate-fee's 600/min endpoint ceiling is shared by all anon callers, so a flood could deny quotes; a per-user limit needs the app to send a user token. 5) The repaired column-locks test (commit 0333065) lives on branch claude/unruffled-joliot-f44d3d and is not merged into home-redesign, so npm test there still runs the old harness-broken version and reports a false regression. 6) Pre-existing live-data test failures (booking-metering Premium fixture, donation and membership suites) need fixtures rebuilt. 7) RESOLVED and VERIFIED IN PRODUCTION 28 Sep (delivers c47f372, merged to home-redesign at 8563e1a): the eight notify-* fan-outs (notify-booking, notify-business-claim, notify-claim, notify-engagement, notify-event-update, notify-hub-content, notify-job, notify-shift-status) all required a signed-in user already, but not that the signed-in user was the right one — a member could trigger a real notification about an entity that wasn't theirs. FIVE genuine gaps closed with a new entity-scoped check per real ownership model (booking: customer or business owner; business-claim: the claimant; engagement: the comment's real author or a genuine reaction row, never a client-named actor_id; job: the applicant or the employer; shift-status: the employer or the withdrawing worker). THREE (notify-event-update, notify-claim, notify-hub-content) already carried an entity-scoped check from an earlier pass the inventory doc predates; their logic was pulled into the same shared module pattern so it is tested identically, not left as an unverified exception. All eight now share the _shared/*-notify-auth.ts pattern (mirroring hub-notify-auth.ts from 25 Sep) and are covered by notify-fanout-authz.node.test.ts (63 tests: an unrelated signed-in user refused, the legitimate party allowed, the service role always trusted, and the gate proven to run before any lookup or send — for every one of the eight). PRODUCTION VERIFICATION 28 Sep: all eight functions ACTIVE and deployed within the same minute; downloaded source diffed byte-identical to the committed source for all eight index.ts files and all nine shared *-notify-auth.ts modules; live unauthenticated and anon-key calls to all eight return 401 with nothing downstream ever executing (proven by the same gate-before-effect tests); the rate-limit actions they reference (notify_direct/notify_fanout/notify_any) already existed in production, no missing-policy gap. The legitimate-caller and service-role paths were verified via the 63 tests against the byte-identical deployed source, not by a live end-to-end call — deliberately, to avoid handling the service-role key directly and to guarantee zero real notification fanout during verification. security-reaudit (34) and rate-limits (15) suites re-run clean alongside it.",
      nextAction: "Schedule after launch; item 5 is quick and worth doing first. Item 7 is done.",
      lastUpdated: "2026-09-28",
    },
    {
      id: "compliance-backups", area: "compliance", title: "Backups & resilience",
      description: "Database backups / point-in-time recovery confirmed and a restore understood.",
      status: "complete", criticality: "launch_blocker", weight: 4,
      evidence: "RESTORE REHEARSAL PASSED 28 Sep. Configuration (supabase backups list, read-only): daily physical (WAL-G) backups, 8 retained (21–28 Sep, all COMPLETED), latest 28 Sep 03:06 UTC. PITR disabled. Rehearsal method: a live logical export (schema then data, public+auth+storage+extensions, read-only against production) loaded into an isolated LOCAL Postgres 17.11 instance (127.0.0.1 only, destroyed afterwards) — production was never written to, no new cloud project created (avoids an unapproved cost decision). Result: 175 tables, 300 functions, 383 RLS policies, 97 triggers, 563 indexes restored with ZERO load errors once the 7 standard platform roles + pg_trgm were pre-created (documented as a required step, not a gap). Representative row counts matched production exactly on every table checked (profiles 268, local_businesses 534, events 56, event_tickets 12, event_ticket_orders 11, driver_profiles 5, book_bookings 7, stripe_customer_claims 3, notification_log 1114, auth.users 268, storage.objects 287; hubs/hub_members correctly 0/0). MD5 checksums of profiles/local_businesses/events/event_tickets primary-key sets matched byte-for-byte. RLS and the 25 Sep security-fix ACLs (anon refused, authenticated allowed on accept_image_pin_suggestion/business_analytics/accept_alert_policy/booking_meter_status) survived the restore intact. Every dump/log file and the isolated instance were deleted at the end; nothing was kept on disk. PITR decision: NOT required for launch. Daily backups + this proven restore path bound the worst case at ~24h data loss, an acceptable RPO for a pre-revenue-scale platform; revisit after a month of real transaction volume. Enabling it now would add cost without Darren's approval. Runbook: DISASTER-RECOVERY-RUNBOOK.md (repo root) — restore points, isolated-rehearsal steps, real-incident procedure, what does NOT come back automatically (Edge Function code/secrets, pg_cron schedules, Stripe webhook config, Storage files), and promotion/cutover. Two things intentionally NOT folded into this blocker: Storage (uploaded file) backup coverage is unconfirmed — tracked separately, see compliance-storage-backup (not launch-blocking: it covers supplementary media, not the transactional/financial data proven above). And: while diagnosing the CLI's Docker dependency, a `--dry-run` diagnostic printed the live DB password in plain text into this session's transcript once, before the risk was caught — recommend rotating the postgres/pooler password as routine hygiene (see the runbook §9); not itself a backup-system defect.",
      lastUpdated: "2026-09-28",
    },
    {
      id: "compliance-storage-backup", area: "compliance", title: "Storage (uploaded file) backup coverage",
      description: "Whether uploaded files (avatars, business photos, etc.) are recoverable, separately from the database.",
      status: "not_started", criticality: "important", weight: 1, scope: "post_launch",
      evidence: "Found 28 Sep while rehearsing database recovery (see compliance-backups / DISASTER-RECOVERY-RUNBOOK.md). The database backup covers storage.objects metadata (287 rows, ~68 MB of declared file size) but not the actual file bytes, which live in Supabase's separate S3-backed Storage backend. Whether that backend is itself versioned or backed up was not established — no API access to check it from here.",
      nextAction: "Ask Supabase Support (or check the dashboard's Storage settings) whether bucket contents are backed up/versioned separately from the database. If not, consider a periodic export of the 10 buckets as a low-cost mitigation.",
      lastUpdated: "2026-09-28",
    },
    {
      id: "compliance-secret-rotation", area: "compliance", title: "Secret hygiene",
      description: "Google service-account key rotated; cron endpoint secret set.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "CRON_SECRET verified. The exposed Google Wallet service-account key (236e0b63) was revoked on 2 Oct 2026 and Google's public key listing no longer contains it. The replacement key (2d5131e4) is installed in production (GOOGLE_WALLET_SA_JSON digest matches it). Production Google Wallet flow physically accepted end to end: the web Add to Google Wallet button opens Google's save page, the Shop Local Shetland card previews, saves into Google Wallet and shows member name, member ID and QR. That test also corrected the issuer id to the 19-digit value, linked the service account as Developer, and created the approved loyalty class. The old local JSON was deleted; remotely reachable history of both repos holds no credential material (no key file, key id or private-key block). The issuer is still in Google's Demo mode ([TEST ONLY] label); that is tracked separately as publishing follow-up, not a blocker here. Supabase database-password rotation remains recommended hardening only. A second active key (a6b81e3b) has unknown provenance and is being investigated separately.",
      lastUpdated: "2026-10-03",
    },
    {
      id: "compliance-under-18", area: "compliance", title: "Under-18 support",
      description: "Accounts for under-18s.",
      status: "not_started", criticality: "nice_to_have", weight: 1, scope: "post_launch",
      evidence: "Sign-up requires 18+ consent; not needed for launch.",
      lastUpdated: "2026-09-15",
    },

    /* ── Content & data readiness ────────────────────────────────────────── */
    {
      id: "content-business-listings", area: "content", title: "Directory listings loaded (unclaimed by design)",
      description: "Businesses are listed at launch before owners claim them; claiming follows through the onboarding campaign.",
      status: "complete", criticality: "important", weight: 4,
      evidence: "534 listings in production on 24 Sep; 1 claimed, 2 claim requests. Unclaimed at launch is the intended model — the claim count is a launch KPI tracked under the business onboarding campaign, not a readiness requirement. Listing accuracy is tracked under Directory data.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "content-claimed-state", area: "content", title: "Claimed / unclaimed presentation",
      description: "Unclaimed listings say so honestly and invite a claim.",
      status: "complete", criticality: "important", weight: 1,
      evidence: "Unpublished businesses stop advertising (0d10c43); claim entry suite.",
      lastUpdated: "2026-09-02",
    },
    {
      id: "content-events", area: "content", title: "Events content",
      description: "Real upcoming Shetland events listed at launch.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "COMPLETE 3 Oct 2026. INVENTORY (all 56 events in production): 52 genuine Shetland events, 4 acceptance/demo events. The 52 were migrated from the old OneShetland calendar on 11 Jun 2026 (one organiser-less batch; nothing genuine has been added since) and run from March to January 2027; 44 are now past and correctly absent from the list. PUBLIC NOW (published, not hidden, hub-approved, not yet ended, which is exactly the rule the website and app apply): 9 events, 8 genuine and 1 labelled test. The 8 genuine upcoming: Shetland Wool Week (27 Sep to 3 Oct, ends today), Christopher Macarthur-Boyd at Mareel (tonight), Shetland Accordion and Fiddle Festival (8 to 11 Oct), Voe Social Club (14 Oct), Calum MacPhail Live at Mareel (16 Oct), Gary Meikle at Mareel (30 Oct), Lerwick Junior Up Helly Aa and Lerwick Up Helly Aa (26 Jan 2027). Dates checked against public sources: Wool Week, Up Helly Aa 2027, the festival start and the 8pm Mareel start all match; two October Mareel gigs could not be confirmed from public listings (not evidence they are wrong). Spread: a real mix of 14 categories across the year, but the genuine upcoming list is thin: six events in the next four weeks and then nothing between 30 Oct and Up Helly Aa on 26 Jan. DATA QUALITY (deterministic, all 52): 0 end-before-start, 0 impossible dates, 0 same-title-same-day duplicates, 0 raw HTML entities or tags, all 52 have a description and a category, 40 have a cover image and all 40 load, 44 have a venue; Mareel gigs convert correctly between GMT and BST (19:30 local all year). Thin rather than broken: descriptions are terse (median 37 characters), no genuine event has a ticket link or price, only 1 has map coordinates, 8 have no venue. LIVE CHECK: the public What's On list matches the database exactly (9 events); all 8 genuine event pages load with the right title, date, venue, description, image where one exists, and no raw values; at phone width the list was 636 px wide in a 375 px viewport (Mareel's long venue name widened the grid), fixed 3 Oct (the day groups now use a shrinkable column) and verified at phone width on the live site. TEST FIXTURES (public, already tracked under the ZZ fixture cleanup, none removed here): 'ZZ TEST - Acceptance Event (not a real event)' id aebbc34a, Tue 6 Oct, published and listed (and, being the only ticketed public event, it is what 'On sale now' shows); it holds 5 orders (1 paid, 3 refunded) and 3 reconciliation rows, so it must be retired, never deleted; 'ZZ TEST - Payout Gate Test' id 9d6ecb93, 25 Sep, published but past so not listed, 8 orders; two cancelled and hidden fixtures (6d1beb6c, 21461777) are not public. The event ticket refund acceptance is already complete; no pending test names these events, but they stay untouched until the Wallet healthy-state acceptance is done. The test event is clearly labelled in its own title. REMAINING CONTENT ACTION, not a blocker: events were last added on 11 Jun and nothing refreshes them (no importer, no schedule), so the Events area will quiet down after 30 Oct unless organisers post or the calendar is topped up with November to January events (Christmas lights, Hogmanay, winter Mareel programme) before or soon after launch; add ticket or booking links for the Mareel gigs. CLEANUP 3 Oct (later the same day): the public test event 'ZZ TEST - Acceptance Event (not a real event)' (aebbc34a) was retired from public view by archiving it (status archived, which the database turns into hidden; not cancelled, so nobody is told it was cancelled). Dependencies were traced first, not inferred: no open readiness item or next action names it (the pending Wallet healthy-state acceptance uses only the hub donation, membership and pass fixtures), the test files that mention it are offline fakes or a throwaway database, and no scheduled job depends on it being published. Nothing was deleted: all 5 orders, 6 tickets, 2 ticket types, 3 check-ins, 3 event refund-reconciliation rows and 2 payment refund-reconciliation rows are byte-identical before and after, as are the ZZ business, its 3 passes and service, the ZZ hub and the other 55 events. Result on the live site: What's On lists exactly the 8 genuine events, the test event and the 'On sale now' section are gone, and the event's page returns 404 to the public; its organiser, admins and its ticket holders can still see it. 'ZZ TEST - Payout Gate Test' (9d6ecb93) is untouched: it is past, so it is not listed, but it remains published and reachable by direct link, to be retired with the other ZZ fixtures.",
      lastUpdated: "2026-10-03",
    },
    {
      id: "content-jobs", area: "content", title: "Jobs content",
      description: "Real current job listings.",
      status: "complete", criticality: "nice_to_have", weight: 1,
      evidence: "COMPLETE 3 Oct 2026, after finding and fixing a silent outage. FINDING: the feed was broken. The council jobs sync runs every three hours on schedule (17 past, every third hour, active), but myjobscotland upgraded its site in September 2026 and the page the sync read became an empty shell, so every run since about 29 Sep answered 'parsed 0, left existing rows untouched'. The fail-safe worked (nothing was wiped) but the feed went stale unnoticed: cron records such a run as succeeded, and the only trace was an HTTP response kept for about six hours. By 3 Oct all 25 rows were last updated on 29 Sep, 17 of the 39 vacancies the council now lists were missing, and two closing dates the council had extended were out of date. Expired jobs were never visible, because the website query, the app query and the database row security each hide a job once its closing date passes. FIX (deployed): the sync now reads the national search results near Shetland (two searches, merged, paged) and keeps the cards published by Shetland Islands Council; it aborts on any failed page so a half-read feed can never prune live jobs; it still refuses to act on an empty parse; it does not prune when the feed is implausibly small next to what is held; pay units ('per hour' or 'per year') are restored; HTML entities are decoded; and the council's internal reference is no longer glued to the title. Every run is now recorded in job_sync_runs (when, ok or the reason, how many parsed and removed), failures are written to the logs and answer HTTP 502. First real run on 3 Oct: 39 synced, 3 closed vacancies pruned. 30 tests run the real function against real post-upgrade markup, and every safeguard was mutation-proved. INVENTORY NOW: 39 jobs, all genuine Shetland Islands Council vacancies via myjobscotland, 0 expired, 0 hidden, 0 manual or test or demo records; closing dates 5 Oct to 3 Nov. QUALITY (all 39): title, employer, location, closing date, pay, contract type and official application link present on every one; no raw entities or markup; no duplicates by source id or application link; three same-title pairs are separate vacancies (different council references, contract or pay) and are kept. LIVE: the public /jobs list shows exactly the 39 in the database; all 39 detail pages load with the right title, pay and location; all 39 application links point at the official listing and all 39 official pages load and name the job. A second layout bug was found and fixed: on a phone the Jobs list was 876 px wide in a 375 px viewport (one long title widened the grid); the list grids now shrink, verified at phone width on the live site. COVERAGE: current and automatically maintained, and users see genuine vacancies; it is a single-employer feed (the council), so private-sector roles appear only if employers post. REMAINING, not blockers: nothing alerts when a sync fails (the log makes it a one-line query, and operations-error-monitoring is the home for alerting); NHS Shetland and other employers are not yet fed; the same mobile grid bug was measured on the live Local page (846 px wide on a 375 px phone) and the pattern appears on about a dozen other pages, handed off as its own task; a separate long-standing check shows four production cron jobs that no migration describes (tracked as its own task).",
      lastUpdated: "2026-10-03",
    },
    {
      id: "content-offers-products", area: "content", title: "Offers & products",
      description: "Real offers and products from real businesses.",
      status: "needs_verification", criticality: "nice_to_have", weight: 1,
      evidence: "AUDITED 3 Oct 2026. THE FINDING: there is no genuine offer, product, pass or bookable-service content anywhere in production. INVENTORY (every row): 0 offers; 2 products, 3 passes and 3 services, every one of them test or demo content. Public today (what an anonymous visitor can read): 0 offers; 1 product ('Hamnavoe Lighthouse Print', GBP 2.00, ZZ TEST fixture business); 2 passes ('ZZ TEST - Wallet Pass', 'ZZ - Demo Pass', both ZZ fixture); 2 bookable services ('ZZ - Test booking', and 'Mens fade' GBP 45 on the seed 'Anderson & Co' CSV demo record, whose 'Hair cut' service is inactive and whose DEMO pass and product are hidden by its free tier). WHAT A VISITOR SEES: the Shop Shetland page (headline: everything on sale from Shetland's own shops and makers) lists exactly one item, the ZZ test print; the Local page's Passes and experiences and Book now sections hold only ZZ items and its stats strip reads '2 passes and experiences, 1 bookable service'; Featured businesses opens with the ZZ fixture, which labels itself 'NOT a real business'. The genuine parts of Local are the 39 live council jobs and the directory of 529 listings. WHY: it is structural, not a bug. Offers need the business on the Pro plan, products and passes need Premium, and all 533 real listings are free-tier and unclaimed (by design for launch); the only paid business in the system is the ZZ fixture. So no real business can currently have published anything. DATA QUALITY of what exists: no duplicates, no expired items, no broken images, no raw entities; hidden or inactive businesses do not expose items; the empty states are honest by design (the Shop says 'No products yet'; Local hides its offers, passes and booking sections and stats when there is nothing). The test items cannot be hidden yet: the ZZ pass, business and service are required for the pending Wallet healthy-state acceptance, and the Anderson & Co seed holds the DEMO gift, pass and booking demo content, so it is left alone while the App Store review is pending; both are already tracked under business-directory-data and content-test-fixtures, so no new blocker is created. FIXED 3 Oct: the Local page scrolled to 846 px on a 375 px phone and at 390 px (two card grids had no base column, so the implicit auto track grew to 495 px and 826 px); all eight grids on the page now start from a shrinkable column; verified live at 375 px (page 375 px, widest card 335 px), at 390 px (page 390 px) and on desktop (column counts unchanged); 2 tests guard it. The same bug on about a dozen other pages is handed off as its own task. WHY IT STAYS OPEN: the requirement is real offers and products from real businesses, and there are none; nothing in code or data can supply them.",
      nextAction: "Before launch, get a handful of real businesses live with real content: claim their listings, put them on the plan that unlocks what they sell (Pro for offers and for switching bookings on; Premium for products and passes. The admin discount-grant tool does NOT do this: it only records a row that nothing redeems, so a free plan is a service-role grant of subscription_tier and subscription_until, which lapses by itself on the expiry date and creates nothing in Stripe) and have them publish real items, so the Shop, offers and passes show genuine content rather than test fixtures. Then, once the Wallet healthy-state acceptance is done, retire the ZZ fixtures (tracked under business-directory-data and content-test-fixtures) and confirm Local reads as a real product. This is business onboarding (see launch-business-onboarding), not a code change.",
      lastUpdated: "2026-10-03",
    },
    {
      id: "content-test-fixtures", area: "content", title: "Real content vs test fixtures",
      description: "Test businesses and events (e.g. ZZ TEST) hidden or removed before public launch.",
      status: "not_started", criticality: "important", weight: 3,
      evidence: "ZZ TEST business and test events exist in production for acceptance testing. Public visibility not checked.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "content-quality", area: "content", title: "Launch content quality",
      description: "Home, directory and What's On read well to a first-time visitor.",
      status: "not_started", criticality: "important", weight: 2,
      evidence: "No launch content review recorded.",
      lastUpdated: "2026-09-24",
    },

    /* ── Operations & support ────────────────────────────────────────────── */
    {
      id: "operations-moderation", area: "operations", title: "Moderation",
      description: "Report, block and an admin reports queue.",
      status: "complete", criticality: "important", weight: 3,
      evidence: "UGC report/block/EULA done for store review; /admin/reports queue.",
      lastUpdated: "2026-09-01",
    },
    {
      id: "operations-support", area: "operations", title: "Support process",
      description: "A public way to get help and someone answering it.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "COMPLETE 3 Oct 2026. One consistent identity everywhere: hello@oneshetland.com, https://oneshetland.com/support and telephone 01595 922404 (+44 1595 922404, tap-to-call), the same details as the Google Pay and Wallet Business Profile. WEB: footer links Support on every page, signed in or out; /support covers payments and refunds, account and login, businesses, and now the phone number; every legal page offers hello@; all 17 public routes checked live return 200. APP: Help and support added to the Me tab, Account screen and sign-in footer (a locked-out user can reach it); in-app Report and Delete account already existed. TELEPHONE (physically evidenced by the operator): 01595 922404 is a live Shetland geographic number; inbound calls reach the Soho66 account; unanswered calls go to voicemail; voicemail-to-email has physically delivered. Messages are therefore monitored although live answering is not enabled, and the page says so honestly (leave a message). EMAIL: the domain's mail server accepts hello@ and support@ (recipient check only, nothing sent); transactional mail replies to hello@ and none of the 42 email templates contains a personal address. OPERATORS: SUPPORT-RUNBOOK.md gives a next step for account, payment and refund, Wallet settlement, merchant, content report, privacy and data request, voicemail, outage and secret-exposure cases, mapped to /admin/payments, /admin/reports, /admin/claims and /admin/compliance. 27 source-level tests guard routes, addresses, phone consistency and web/app parity. NOT blockers, tracked as polish: custom voicemail greeting; an alert when a content report arrives (the 24-hour promise currently relies on checking /admin/reports); the reports queue records a decision but does not remove content; single operator; App Store listing quotes support@ and the bare site URL (an App Store Connect edit for later).",
      lastUpdated: "2026-10-03",
    },
    {
      id: "operations-error-monitoring", area: "operations", title: "Error monitoring",
      description: "Production errors on web, app and edge functions are seen without a user reporting them.",
      status: "not_started", criticality: "important", weight: 3,
      evidence: "No error-tracking service in either repo. Only auth-stage analytics telemetry exists.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "operations-reconciliation", area: "operations", title: "Payment reconciliation",
      description: "Stripe transfers and merchant statements reconcile with the ledger.",
      status: "complete", criticality: "important", weight: 3,
      evidence: "COMPLETE 2 Oct 2026 — physically accepted on BOTH rails with real live-mode payments, each verified read-only against the database and Stripe (no further money moved by the verification). CARD-FUNDED event purchase and refund: order 00f05623-dbb7-4623-9945-b348207c3126 (event 'ZZ TEST — Acceptance Event', 1 × 'TEST — Paid Entry', £1.00 + 96p booking fee = £1.96, saved Mastercard), PaymentIntent pi_3UM8wSCCZSiMQBCg1s6Ai5zF, livemode true, succeeded, 196p with 96p application fee to the canonical connected account; one charge ch_3UM8wSCCZSiMQBCg13bMxCMy, refunded in full by exactly ONE refund re_3UM8wSCCZSiMQBCg1bzu8sSI (196p, succeeded, initiated through OneShetland: metadata refunded_by + event_order_id, reverse_transfer attached); the destination transfer tr_3UM8wSCCZSiMQBCg1F7SHbEp (196p) is fully reversed by exactly ONE reversal trr_1UM8xUCCZSiMQBCgp6aEZ9dM (196p), the only transfer to the merchant in that window; the 96p application fee fee_1UM8wTFrYnE2DH83fgMRZRmD is fully refunded by exactly ONE fee refund fr_1UM8xUFrYnE2DH83bT10gLXc (96p), so the merchant holds nothing and OneShetland is not out of pocket. Reconciliation row state 'reconciled', transfer gap 0, fee gap 0, no repair attempted or needed, never flagged, verified by refund-payment 16:05:18 and re-checked 16:05:24 UTC (one 'verified' audit event). Webhooks payment_intent.succeeded and charge.refunded each received once, processed first attempt, no error. Order refunded with refunded_at set; its one ticket refunded (void), never checked in; exactly one order per request id and per PaymentIntent. WALLET-FUNDED event purchase and refund: order bc622739-8cd8-4e3c-8d34-88ce96269581 (£1.96 spent from the Wallet): ledger spend −196 and exactly one linked reversal +196 (Wallet balance returned to £5.00, no deficit); one Connect transfer tr_1UM67oCCZSiMQBCgsYcV27nt (100p) fully reversed by exactly one reversal trr_1UM7DqCCZSiMQBCggtQBmpzc (100p); no application fee exists on this rail and the 96p booking fee stayed on the platform and came back with the full credit; order refunded, ticket void; reconciliation 'reconciled' (rail event_ticket_wallet, no PaymentIntent invented), transfer gap 0, Wallet gap 0, checked 15:41 UTC. BOTH RAILS, proven live: refund the customer correctly, reverse the merchant settlement correctly, return the platform fee/accounting correctly, void the ticket, release capacity, and reconcile to zero gaps. CAPACITY: a refund now returns its seats by recount (card and Wallet identical, once, never negative; a checked-in ticket keeps its seat; the sale gate is event_ticket_types.quantity_sold, healed under the reservation lock and by a 15-minute self-heal). Live after both refunds: 'TEST — Paid Entry' 0 of 2 sold (counter = held seats = 0), 'TEST — Free Entry' 2 of 5, event sold 2 = 2 live tickets, zero drift anywhere. NOT SAMPLED LIVE: the purchase-time counter value of the card order was not read while the ticket was held (increment-on-purchase is proven against the real functions in an isolated Postgres, not observed on this order); the release and the final state were. TESTS: 699 isolated-Postgres tests pass (capacity 23, incl. the refund-versus-scan race), Wallet verdict suite 33, card reconciliation suite 60 unchanged, and the live rolled-back suites for checkout idempotency, basket atomicity, expiry, refunds and RPC exposure. STILL OPEN, deliberately outside this item: (1) the two 25 Sep card refunds (orders abcc7c92 and 245bd018, £1.96 each) remain flagged needs_repair in Admin — merchant still holds £1.00 each, nothing moved, Darren has not yet decided; (2) hub donation, hub membership and pass purchase still lack the Wallet liquidity gate (tracked under commerce-local-wallet); (3) hub donations, memberships, boosts, Fetch and shift payments have no live-mode transaction reconciled yet. BACKGROUND — HARDENING DEPLOYED 2 Oct (now proven live, above): charge.refunded, refund-payment and a 30-minute flag-only sweep now verify the merchant transfer reversal and application-fee refund against Stripe and record a derived state; a recent FULL event-ticket refund is repaired automatically in one atomic idempotent reversal, everything else is flagged (needs_repair / needs_review / repair_failed) and shown in Admin > Payments; the sweep has flagged both historical orphans (nothing moved). product_orders now has an allowlist trigger so a merchant can change lifecycle fields only, and book_unit_purchases (passes) has the same lock with an EMPTY client allowlist, derived from an inspection showing no mobile or web code writes that table (every database writer is SECURITY DEFINER, every edge function uses the service role); both proven in an isolated Postgres under real RLS with a mutation test, and live in production with the 8 real pass rows verified unchanged. Original reconciliation follows. 2 Oct read-only production reconciliation (no transactions created) found one real defect. SCOPE: all 19 live-mode PaymentIntents (11 succeeded, 7 abandoned and 1 cancelled with no money moved), 10 transfers, 9 application fees, 2 refunds, 0 disputes, set against every OneShetland table carrying a Stripe id. CLEAN: each of the 11 succeeded PIs maps to exactly one OneShetland row in exactly one table, nothing duplicated; amounts, fees, destination and ownership match on events (3), products (2), passes (2), gifts (2) and Wallet top-ups (2); every destination charge's transfer equals the charge, goes to the canonical business_payout_destination() account (event organiser resolved separately and matches), is livemode, and has one processed transfer.created webhook; all webhook events processed first attempt with no failures or duplicate commerce effects. Fees match the model in force: events 95p + 1.5% = 96p on £1.00, products 5% = 10p on £2.00, gifts/passes 5% = 5p on £1.00, Wallet 27p on the 10:02 £1 spend (in-code default 2% + 25p, config unset at the time) then 5p on the 13:40 £5 spend (premium 1%, config set 11:16). WALLET REVERSAL IS CLEAN: the £1 spend transferred 73p (100 less 27p fee), reversed in full (73p, one reversal), ledger spend −100 + linked refund +100 nets to zero; the £5 spend whose transfer failed left no Stripe object and nets to zero. DEFECT: both live card refunds (re_3UJMo9… and re_3UJVdt…, 25 Sep, event tickets £1.96 each) were issued with no reverse_transfer or refund_application_fee and no refunded_by metadata, so not through refund-payment (probably the Stripe Dashboard). The customers were refunded in full but both transfers (£1.96) are un-reversed and both 96p application fees un-refunded: the merchant account keeps £1.00 per refund (£2.00 orphaned) and OneShetland is £2.00 out of pocket. event_ticket_orders still says refunded, because the charge.refunded webhook marks refunds without checking the merchant's money came back, so nothing flags it. refund-payment itself sets both flags in code but has never been exercised live on a card destination charge. DIVERGENCE: product_orders lets the owning business UPDATE its own orders and the lock trigger covers refund columns only, so money columns (total_pence, commission_pence, payment_intent_id) are client-editable; event, gift and Wallet rows have no client write path. TRACEABILITY: every PI maps to its row by PI id and PI metadata carries order/gift/business/buyer ids (not the purchase id on passes); Wallet spends store the transfer id and the transfer metadata carries the ledger row id; destination-charge transfer ids, application-fee ids and refund ids are stored nowhere in OneShetland (found via PI → charge in Stripe). Hub donations, memberships, boosts, Fetch and shift payments have no live-mode transaction yet and are not covered.",
      nextAction: "None for this item — monitor the reconciliation panel. Open elsewhere: Darren decides the two orphaned 25 Sep event-refund payouts (abcc7c92, 245bd018; nothing moved); put hub donation, hub membership and pass purchase behind the Wallet liquidity gate (commerce-local-wallet).",
      lastUpdated: "2026-10-02",
    },
    {
      id: "operations-failed-payments", area: "operations", title: "Failed-payment handling",
      description: "Declines are explained, abandoned orders release their seats.",
      status: "complete", criticality: "important", weight: 3,
      evidence: "Decline handling (8dcfa58); expire_stale_ticket_orders(60) scheduled every 5 minutes.",
      lastUpdated: "2026-08-27",
    },
    {
      id: "operations-refunds", area: "operations", title: "Refunds",
      description: "Admin and hub-owner refunds through refund-payment.",
      status: "complete", criticality: "important", weight: 2,
      evidence: "refund-payment verified in the 19 Aug audit; web admin refunds and Wallet refunds with suites.",
      lastUpdated: "2026-09-09",
    },
    {
      id: "operations-rollback", area: "operations", title: "Rollback & recovery",
      description: "A written way back for a bad web deploy, OTA or migration.",
      status: "not_started", criticality: "important", weight: 2,
      evidence: "Netlify and EAS both support rollback, but no runbook is recorded.",
      lastUpdated: "2026-09-24",
    },

    /* ── Launch & marketing ──────────────────────────────────────────────── */
    {
      id: "launch-facebook-post", area: "launch", title: "Personal Facebook launch post",
      description: "Darren's own launch announcement.",
      status: "not_started", criticality: "important", weight: 1,
      evidence: "Unconfirmed.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "launch-social-content", area: "launch", title: "OneShetland social content",
      description: "Scheduled social posts from the Social studio.",
      status: "in_progress", criticality: "important", weight: 2,
      evidence: "Social studio with per-recipe autopilot and global pause (0bff647); brand card updated 15 Sep. Posting cadence unconfirmed.",
      lastUpdated: "2026-09-15",
    },
    {
      id: "launch-shetland-times", area: "launch", title: "Shetland Times",
      description: "Local press coverage around launch.",
      status: "not_started", criticality: "nice_to_have", weight: 1,
      evidence: "Unconfirmed.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "launch-business-onboarding", area: "launch", title: "Business onboarding campaign",
      description: "Direct outreach to get businesses claiming and selling.",
      status: "in_progress", criticality: "important", weight: 3,
      evidence: "Outreach and email-hunt lists compiled (Aug). Sends not recorded. KPI on 24 Sep: 1 of 534 listings claimed, 2 claim requests.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "launch-communications", area: "launch", title: "Launch communications",
      description: "What users are told at public launch, moving on from soft launch.",
      status: "not_started", criticality: "important", weight: 1,
      evidence: "Soft-launch page exists; public launch messaging not drafted.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "launch-release-timing", area: "launch", title: "App-store / public release timing",
      description: "A date for public launch and App Store release.",
      status: "not_started", criticality: "important", weight: 1,
      evidence: "No date decided.",
      lastUpdated: "2026-09-24",
    },
  ],
};
