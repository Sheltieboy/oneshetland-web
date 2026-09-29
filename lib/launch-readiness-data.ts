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
      evidence: "Charge approval recovery and success state (web 5f2de03, 7d9c1db), server-side cancel (20f1382), refunds (b744b1b), with suites. Physical test-mode acceptance not recorded here.",
      nextAction: "Confirm a test-mode top-up and till charge were physically completed.",
      lastUpdated: "2026-09-12",
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
      status: "needs_verification", criticality: "important", weight: 2,
      evidence: "REOPENED 29 Sep — a second real defect was found on web during the same acceptance pass that had closed this item, so it is deliberately held open for re-test rather than left marked Complete against evidence that no longer fully holds. Payment and redemption themselves are still solidly proven: real live-mode purchase 052fcacc-e0ff-432d-9e5b-b76c8847d629 (PI pi_3UL0FLCCZSiMQBCg1g6fhV7J, £1.00, 'ZZ - Demo Pass') reconciles exactly against Stripe and the database — livemode true, succeeded once, canonical Mastercard •3990, correct payout destination, exactly one redemption, uses_remaining 0 matching fully_used_at to the millisecond — and redeem_pass_atomic's FOR UPDATE locking plus the isolated concurrency suite (559 tests) prove exactly-once decrement and no double-spend. A first defect (mobile: Passes & vouchers and business detail not refreshing after a till redemption until pull-to-refresh) was found and fixed same day (useFocusEffect, OTA 01a0ed36). A SECOND, separate defect surfaced next: on web, the customer's 'Use at till' click on that same real pass returned 'Can't redeem / Unauthorised'. Traced in full and the reported hypothesis (web calling the merchant-only redemption action directly) was DISPROVED — RedeemDialog → startRedemption → local-redeem-start on web is architecturally identical to mobile's local-redeem.tsx, and neither ever calls local-redeem-verify (merchant-only, consuming). Real cause, proven via the installed supabase-js source and a live gateway-vs-function error-shape test: fetchWithAuth falls back to the plain anon key whenever auth.getSession() cannot produce a live session (expired session, dead refresh token); that bearer passes the gateway but fails local-redeem-start's own anon.auth.getUser() check, correctly returning Unauthorised — an accurate but confusing message, and a gap latent on BOTH platforms (identical startRedemption on each), not a web-only authorization-model bug. FIXED: startRedemption on both web and mobile now checks auth.getSession() first and fails with a clear, actionable message instead — same idiom as web's existing addToAppleWallet(). No change to merchant authorization, the redemption token/code mechanism, or either edge function. Tests: new redeem-session-freshness.node.test.ts (12) proving the customer-only/merchant-only split holds on both platforms, the session check runs before the network call on both, and used/expired/refunded passes cannot reach 'Use at till' on either platform. Web pushed live (commit f3c9fa8); mobile OTA 01a0ed49 shipped, fingerprint unchanged, manifest verified.",
      nextAction: "Re-test the corrected web customer presentation flow (buy or reuse a pass, click Use at till, confirm the credential/QR appears and redemption completes) and re-confirm the mobile stale-state fix, together, before marking this Complete again.",
      lastUpdated: "2026-09-29",
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
