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
      evidence: "529 listings as of Aug 2026; import, duplicate-finding and opening-hours scripts exist. Accuracy has not been re-audited since.",
      nextAction: "Spot-check a sample of listings for duplicates, closed businesses and wrong hours.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "business-claiming", area: "business", title: "Business claiming",
      description: "An owner can claim an existing listing and an admin can approve it.",
      status: "needs_verification", criticality: "important", weight: 4,
      evidence: "Claim flow simplified 2 Sep (605fd7f, fac7862) with directory-claim-entry suite; admin claims queue exists. Launch starts with listings unclaimed by design, so this item is the flow's readiness, not the number of claims. A full claim → approval → dashboard run is not recorded.",
      nextAction: "Run one claim with a test account through approval to the business dashboard.",
      lastUpdated: "2026-09-24",
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
      status: "in_progress", criticality: "launch_blocker", weight: 6,
      evidence: "Verified after payment 25 Sep: order paid, one valid ticket with a validation hash, inventory incremented once, PaymentIntent succeeded, destination transfer and application fee correct, webhooks processed once, no duplicate order or PaymentIntent, abandoned orders cancelled with no inventory effect. STILL OPEN: the ticket has not been scanned or checked in (checked_in_at null, status valid), and the rendered organiser 'sold' figure and the buyer's ticket display have not been physically viewed.",
      nextAction: "Physically scan or check in the valid ticket with the organiser tool, then confirm status used, checked-in count 1 and that a second scan is refused.",
      lastUpdated: "2026-09-25",
    },
    {
      id: "events-ticket-ownership-display", area: "events", title: "'Your ticket' shown only for genuinely issued tickets",
      description: "Personalised strips and cards mark an event as owned only when the buyer holds a valid or used ticket — never for a pending, cancelled, refunded or abandoned checkout.",
      status: "in_progress", criticality: "launch_blocker", weight: 4,
      evidence: "Launch blocker while unresolved: it falsely tells a customer they own a ticket they have not purchased. Root cause (24 Sep): the web For You query (lib/for-you.server.ts) read event_tickets by holder_id with no status filter, so pending_payment, cancelled and refunded rows showed 'your ticket'; cleanup working did not help because the cancelled row still matched. FIX IMPLEMENTED 24 Sep: one shared OWNED_TICKET_STATUSES (valid, used) in lib/event-ticket-utils.ts, used by For You and web My Tickets; For You now filters status and applies the upcoming-event constraint inside the query. Matches holds_ticket_for(), get_event_social_stats() and mobile My Tickets. Tests: status matrix incl. free claim, contract over every client read of event_tickets, live parity with the DB helpers; mutation-checked. Pushed to main 24 Sep (66090e6). VERIFIED against production data: for the test buyer the old rule would show 'your ticket' on two upcoming events (the ZZ paid-test event, from a cancelled and a pending_payment row — false — and the free acceptance event, from two used tickets — genuine); the new rule leaves only the genuine free-claimed one. NOT yet closed: the deploy of a server-only change leaves no external fingerprint and the rendered strip can only be seen from the buyer's own session, so the on-screen result is still to be confirmed.",
      nextAction: "Open the homepage signed in as the test buyer: the ZZ TEST paid event must NOT show 'your ticket' while the free acceptance event still does. Then mark complete.",
      lastUpdated: "2026-09-24",
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
      status: "needs_verification", criticality: "important", weight: 2,
      evidence: "24 Sep. Root cause: the flag was a cache, true for 4 profiles with no Stripe customer, and Account/Payments read the flag while checkout resolved the card canonically. Server: reconcile-saved-cards deployed (cron-secret gated, dry-run first); real run checked 6 profiles: 2 already consistent, 1 recovered (a provably-owned customer bound through the canonical claim/settle path, card attached), 3 flags correctly cleared (no provable customer, nothing created). Production now has 0 profiles flagged without a bound customer; guard trigger trg_profiles_card_flag_needs_customer and nightly job reconcile-saved-cards are live. 35 tests pass incl. live invariant checks. Web Account/Payments and mobile Account/Me now read the saved-card-state resolver (brand + last4 only). Re-verified 25 Sep ~00:07 UTC: reconciler dry run against live Stripe checked 3 → 3 consistent, 0 to recover, 0 to clear (every flagged profile has a bound customer with 1 card); 0 profiles flagged without a bound customer; trigger enabled; nightly job active (first run 03:25 UTC 25 Sep); reconcile-saved-cards v2, saved-card-state v1 live; web 6ba6518 on main (no display reads the flag); mobile OTA 694aef52 is the current production update on runtime 990f08a7. 213 saved-card tests pass (8 suites, live parts included). Migration 20261016000000 is live but not recorded in schema_migrations (idempotent). NOT verified: the rendered production Account, Payments & banking and paid-event checkout screens, which need a physical check.",
      nextAction: "Physically open Payments & banking (web and app) and the paid-event checkout as the recovered buyer; confirm the badge shows the card and checkout shows the same card.",
      lastUpdated: "2026-09-25",
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
      status: "not_started", criticality: "launch_blocker", weight: 10,
      evidence: "Both apps still use pk_test. Dashboard work only Darren can do (LAUNCH-CHECKLIST.md Phase 2).",
      nextAction: "Work through LAUNCH-CHECKLIST.md Phase 2 in one sitting.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "payments-live-acceptance", area: "payments", title: "Live-mode payment acceptance",
      description: "One real low-value payment through each money path, plus a refund.",
      status: "blocked", criticality: "launch_blocker", weight: 6,
      evidence: "Waits on live-mode cutover.",
      nextAction: "LAUNCH-CHECKLIST.md Phase 6 after cutover.",
      lastUpdated: "2026-09-24",
    },

    /* ── Wallet & commerce ───────────────────────────────────────────────── */
    {
      id: "commerce-local-wallet", area: "commerce", title: "Local Wallet",
      description: "Top-up, pay-at-till charge approval, cancellation and refunds.",
      status: "needs_verification", criticality: "important", weight: 4,
      evidence: "Charge approval recovery and success state (web 5f2de03, 7d9c1db), server-side cancel (20f1382), refunds (b744b1b), with suites. Physical test-mode acceptance not recorded here.",
      nextAction: "Confirm a test-mode top-up and till charge were physically completed.",
      lastUpdated: "2026-09-12",
    },
    {
      id: "commerce-products", area: "commerce", title: "Products & basket",
      description: "Buying a business's products through the basket.",
      status: "needs_verification", criticality: "important", weight: 3,
      evidence: "Manual test-mode product purchases were made in Aug. 24 Sep saved-card change to create-product-order-intent is undeployed.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "commerce-passes", area: "commerce", title: "Passes & unit purchases",
      description: "Buying and redeeming passes / units.",
      status: "needs_verification", criticality: "important", weight: 2,
      evidence: "Unit purchase, redemption and pass history suites. Physical acceptance not recorded here.",
      lastUpdated: "2026-09-06",
    },
    {
      id: "commerce-bookings", area: "commerce", title: "Bookings & payment status",
      description: "Appointment bookings in Shetland time with correct payment state.",
      status: "needs_verification", criticality: "important", weight: 2,
      evidence: "Canonical time and terminal-state suites (Sep 2–3). Physical acceptance not recorded here.",
      lastUpdated: "2026-09-03",
    },
    {
      id: "commerce-gifts", area: "commerce", title: "Gifts",
      description: "Sending, claiming and redeeming gifts.",
      status: "needs_verification", criticality: "important", weight: 2,
      evidence: "Gift claim and visibility fixes (6 Sep) with suites. Physical acceptance not recorded here.",
      lastUpdated: "2026-09-06",
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
      evidence: "Two iOS OTAs on 20 Sep verified via served manifest and bundle hash. Trap: any eas.json edit changes the fingerprint and strands 144.",
      lastUpdated: "2026-09-20",
    },
    {
      id: "mobile-app-store", area: "mobile", title: "App Store readiness",
      description: "Production submission: listing, screenshots, privacy labels, reviewer account, live Stripe key.",
      status: "not_started", criticality: "launch_blocker", weight: 8,
      evidence: "App is not published. Launch checklist Phase 4 items open.",
      nextAction: "Decide release timing, then create the reviewer account and privacy labels.",
      lastUpdated: "2026-09-24",
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
      evidence: "Public surface contract and not-found recovery suites; sitemap and robots in place.",
      lastUpdated: "2026-09-15",
    },

    /* ── Notifications & email ───────────────────────────────────────────── */
    {
      id: "notifications-centre", area: "notifications", title: "Notification centre",
      description: "In-app and web notification inbox with preferences.",
      status: "needs_verification", criticality: "important", weight: 2,
      evidence: "Notifications spine and web /notifications exist. Not reviewed for launch.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "notifications-transactional", area: "notifications", title: "Transactional notifications",
      description: "Ticket receipts, billing emails and push for payments and orders.",
      status: "needs_verification", criticality: "important", weight: 3,
      evidence: "Ticket receipt and billing email migrations (18 Aug). Whether push tokens are stored in production is unconfirmed.",
      nextAction: "Confirm a ticket receipt email and a push arrive after the £1 purchase.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "notifications-email", area: "notifications", title: "Email readiness",
      description: "Verified sender domain, auth templates and a working contact mailbox.",
      status: "needs_verification", criticality: "important", weight: 3,
      evidence: "Auth confirmation and reset emails work. The soft-launch page flags hello@oneshetland.com as 'set before going live' — mailbox not confirmed.",
      lastUpdated: "2026-09-24",
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
      evidence: "ConsentBanner gates AnalyticsProvider on the web.",
      lastUpdated: "2026-08-29",
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
      description: "The 19 Aug audit's launch blockers closed and guarded by tests.",
      status: "needs_verification", criticality: "launch_blocker", weight: 6,
      evidence: "RPC lockdown, identity binding, column locks and atomic redemption landed with rpc-exposure, identity-binding and column-locks suites. 24 Sep: column-locks investigation completed — no live security regression. The failure was a harness/fixture fault: production has 0 hubs and every owned business plus the first driver row belong to an admin (a trusted writer by design), so the probe returned no row. Live lock triggers and functions match migration 20260819180000. Harness repaired (delivers 0333065): non-admin business, hub and driver fixtures built inside a rolled-back transaction; 24/24 assertions pass against the live schema, including hub locks and driver self-approval. No production data or controls were changed. The rest of the 19 Aug blocker list has not been re-audited since 19 Aug.",
      nextAction: "Review the remaining 19 Aug security-audit blocker list and close each outstanding item with evidence.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "compliance-backups", area: "compliance", title: "Backups & resilience",
      description: "Database backups / point-in-time recovery confirmed and a restore understood.",
      status: "needs_verification", criticality: "launch_blocker", weight: 4,
      evidence: "Checked 24 Sep (supabase backups list): daily physical backups completing, latest 24 Sep 03:04 UTC, 8 retained. PITR is disabled. No restore has been rehearsed.",
      nextAction: "Decide whether to enable PITR before taking live payments, and rehearse one restore.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "compliance-secret-rotation", area: "compliance", title: "Secret hygiene",
      description: "Google service-account key rotated; cron endpoint secret set.",
      status: "needs_verification", criticality: "important", weight: 2,
      evidence: "cron-auth suite exists. Rotation of the Google key (launch checklist 5.1) unconfirmed.",
      lastUpdated: "2026-09-24",
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
      status: "needs_verification", criticality: "important", weight: 2,
      evidence: "Volume of real upcoming events not checked.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "content-jobs", area: "content", title: "Jobs content",
      description: "Real current job listings.",
      status: "needs_verification", criticality: "nice_to_have", weight: 1,
      evidence: "Not checked.",
      lastUpdated: "2026-09-24",
    },
    {
      id: "content-offers-products", area: "content", title: "Offers & products",
      description: "Real offers and products from real businesses.",
      status: "needs_verification", criticality: "nice_to_have", weight: 1,
      evidence: "/local only shows offers that exist (d7e7391). Real volume not checked.",
      lastUpdated: "2026-09-24",
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
      status: "needs_verification", criticality: "important", weight: 2,
      evidence: "Public Support page (9c493ac, 14 Sep). Contact mailbox not confirmed.",
      lastUpdated: "2026-09-14",
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
      status: "needs_verification", criticality: "important", weight: 3,
      evidence: "Transfer reconciliation and statement accounting fixes (7–10 Sep). Not yet exercised against real paid orders.",
      lastUpdated: "2026-09-10",
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
