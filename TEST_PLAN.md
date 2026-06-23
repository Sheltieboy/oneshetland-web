# OneShetland — pre-launch test plan (Stripe TEST mode)

Work top to bottom. Do the money flows on **both web and app** where both exist. Keep the Stripe **test-mode** dashboard open in a tab — most checks are "did the money split correctly".

## Test data you'll reuse
- **Card (success):** `4242 4242 4242 4242`, any future expiry, any CVC, any postcode.
- **Card (declined):** `4000 0000 0000 0002`.
- **Card (needs 3-D Secure):** `4000 0025 0000 3155`.
- **Connect onboarding:** in Express test onboarding use the **"Use test data"** / skip options; test bank = sort code `10-88-00`, account `00012345`.
- Stripe → **Payments** shows each charge; open a charge to see `application_fee` (your cut) and the **transfer** to the connected account. Stripe → **Connect → Accounts** shows each business/hub/driver balance.

---

## Phase 0 — Setup (once)
- [ ] Confirm Stripe is in **test mode** and `/admin/config` has test price IDs for `stripe.price.local_pro`, `_premium`, `_addon`.
- [ ] (Push only — Phase 6) run the `push_token` SQL from `LAUNCH_CHECKLIST.md`.
- [ ] Create test accounts (separate emails, e.g. `you+cust@`, `+biz@`, `+driver@`, `+hub@`, `+admin@`):
  - **Customer**, **Business owner**, **Driver**, **Hub admin**, **Admin**.
- [ ] Make the admin account an admin — Supabase SQL editor:
  ```sql
  update public.profiles set role = 'admin' where id =
    (select id from auth.users where email = 'you+admin@example.com');
  ```
- [ ] Approve the driver and any driver/business as needed via `/admin` (driver approvals, business claims).

---

## Phase 1 — Auth & account (web + app)
- [ ] Sign up → receive + click email confirmation → sign in.
- [ ] **Forgot password** (web `/forgot-password`, app "Forgot your password?") → email arrives → reset on `oneshetland.com/reset-password` → sign in with new password.
- [ ] Edit profile (name, photo, area). Sign out.

## Phase 2 — Central payments setup
- [ ] **Add card** at `/account/payments` → shows "on file ✓". *Stripe → Customers: a payment method is saved.*
- [ ] **Connect payouts (personal)** → Express test onboarding → returns "connected". *profiles.stripe_payouts_enabled = true.*
- [ ] Create a **business** (`/directory/new`) → `/business/[id]/manage` → **connect business bank** → returns connected. *local_businesses.payout_enabled = true.* (Needed before tickets/gifts/wallet/donations will take money.)

## Phase 3 — Business subscriptions & add-ons (revenue)
- [ ] Upgrade business to **Pro** (test card) → tier shows Pro. *Stripe → Subscriptions: active, £19.99.*
- [ ] Upgrade **Pro → Premium** → confirm prorated change. *Subscription item swapped to Premium price.*
- [ ] Enable a **2nd premium add-on** → plan total shows **£59.99**; *Stripe subscription gains a £10 add-on line item (prorated to next invoice).* Disable it → back to £49.99, item removed.
- [ ] "Manage subscription" opens the Stripe billing portal. Cancel → shows "cancels on …". *cancel_at_period_end = true.*

## Phase 4 — Fetch (revenue)  *(needs: customer has a card; driver approved + bank connected)*
- [ ] **Customer** requests a delivery → fee estimate shows. (If no card: prompted to add one.)
- [ ] **Driver** sees the open request → **Accept**. *Stripe: an UNCAPTURED PaymentIntent appears, with `application_fee_amount` = £1.50 and `transfer_data.destination` = driver's account.*
- [ ] Driver: **I've arrived** → wait past grace → **Mark collected** (waiting fee ticks) → **Mark delivered**. *PaymentIntent is now captured; driver's connected balance increases by (fee − £1.50 − Stripe fee); your platform balance keeps £1.50 minus Stripe's cut.*
- [ ] Customer detail page updates **live** through the stages; header shows the live status pill.
- [ ] **Cancel** a pending request, then a matched one — both behave per the rules.

## Phase 5 — Tickets, memberships, donations, gifts, wallet
- [ ] **Event tickets**: create an event under the payout-ready business → buy **2 tickets**. *Charge = face + 95p × 2; `application_fee` = £1.90; transfer to organiser.* Scan/validate a ticket.
- [ ] **Hub membership**: create a hub (+ connect hub payouts) → join a **paid** tier. *Charge = price + 95p; transfer to hub.*
- [ ] **Donation**: donate **without** "cover the fee" (*hub nets donation − Stripe fee; you keep ~£0*), then **with** it ticked (*hub nets the full amount; donor paid the extra*). Try the **Gift Aid** path on a charity hub.
- [ ] **Gift / class purchase**: buy one → *business receives the money (transfer), you keep 5%.* Then try buying from a business **without** payouts set up → should be **blocked** ("not set up to take payments").
- [ ] **Local Wallet**: top up (≥ £10) → balance updates. Pay a business with the wallet → *2.5% fee + cashback deducted, net transferred*; business sees the receipt in its dashboard.
- [ ] **Declined card** (`4000…0002`) on any pay flow → graceful error, no order created.

## Phase 6 — Push notifications (after the SQL in Phase 0)
- [ ] On a real device, grant notification permission. *profiles.push_token is set.*
- [ ] Trigger a new Fetch request → the **driver** gets a push.
- [ ] In notification settings, turn **Fetch off** → trigger again → **no** push. Set **quiet hours** to now → non-urgent pushes suppressed.
- [ ] Check `notification_log` for `sent` / `skipped_pref` / `skipped_quiet` rows.

## Phase 7 — Non-money journeys (quick pass, web + app)
- [ ] Directory / Local browse → business detail; claim a listing.
- [ ] Memories: create with photo, **voice note** (needs the rebuilt app for audio), edit, see it on the map.
- [ ] Spik search; Da Boats search/detail; Games (play one, leaderboard updates); What's On.
- [ ] Jobs & Shifts: post a job, apply as another user, move them through the pipeline.
- [ ] Hubs: post a notice, approve a member, send a broadcast.

## Phase 8 — Admin
- [ ] `/admin` loads only for the admin account (others get redirected).
- [ ] Driver approvals, business claims, event approvals, alert-access requests, config, operations all load and act.

## Phase 9 — Security spot-check
- [ ] As a normal (non-admin) user in the Supabase SQL editor (or via the app), confirm you can't see others' data:
  ```sql
  select * from local_wallet_balances;  -- only your own
  select * from admin_config;           -- empty
  select * from delivery_requests;      -- only your own
  ```
- [ ] A non-owner can't open `/business/[someone-else's-id]/manage` (redirects).

---

When every box is ticked in test mode, switch to live keys per `LAUNCH_CHECKLIST.md` and re-run **Phase 2–5 once** with a real card (small amounts) before opening up.
