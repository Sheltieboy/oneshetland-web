# OneShetland — Launch checklist

What's done and what you (Darren) need to do to go live. Items marked **[You]** need your Stripe/Supabase/Apple dashboards — I can't reach those.

---

## 1. Stripe go-live  **[You]**
- Switch Stripe to **live mode**.
- Create live recurring Prices: Pro £19.99/mo, Premium £49.99/mo, add-on £10/mo. Copy the live price IDs.
- In **/admin/config**, set the LIVE price IDs:
  - `stripe.price.local_pro`, `stripe.price.local_premium`, `stripe.price.local_addon`
- Set the live secret key as a Supabase function secret:
  `supabase secrets set STRIPE_SECRET_KEY=sk_live_… --project-ref nkrtmakxygkvxuxriiil`
- Set the live publishable key: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (web host env) and `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (EAS secret).
- **Webhook**: add endpoint `https://nkrtmakxygkvxuxriiil.supabase.co/functions/v1/stripe-webhook` with events:
  `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`,
  `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_succeeded`. Then set `STRIPE_WEBHOOK_SECRET` as a function secret.
- **Connect**: confirm Express onboarding works in live mode for businesses, hubs and drivers.

## 2. Database — one SQL statement  **[You]**
Push notifications need a `profiles.push_token` column that couldn't auto-apply (migration-history drift). Run in **Supabase → SQL editor** (project `nkrtmakxygkvxuxriiil`):
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON public.profiles(push_token) WHERE push_token IS NOT NULL;
```
Until this runs, pushes log `no_token` and don't deliver (no errors). The migration file `079_push_tokens.sql` is in the app repo for the record.

## 3. RLS — verified safe ✅
Audit: all ~60 tables have RLS enabled with correct owner-scoping; only two intentional public-read cases (partner alerts, shift-alert matching). Spot-check in staging as a normal (non-admin) user:
```sql
select * from local_wallet_balances;  -- should show only your own
select * from admin_config;           -- should be empty (not admin)
select * from delivery_requests;      -- should show only your own
```

## 4. Fees — set ✅ (test mode)
- Fetch £1.50 service fee (cut from delivery fee); tickets & memberships flat **95p**; gifts/class purchases 5% to platform with business paid; donations: hub bears Stripe fee + optional donor "cover the fee". All deployed.
- `on_behalf_of` deliberately NOT used (your Connect accounts have `transfers` only, not `card_payments`); the platform fee is sized so the recipient effectively bears Stripe's cut. To move dispute liability onto sellers later, add `card_payments` capability to onboarding and switch to `on_behalf_of`/direct charges.

## 5. Maps & email  **[You]**
- Google Maps: billing enabled, key referrer-restricted to oneshetland.com.
- Supabase auth emails (confirm signup, **reset password**) templates set + sender domain verified. The app's new "Forgot password" sends users to `oneshetland.com/reset-password`, so that page must be live.

## 6. Mobile app — EAS build & stores  **[You]**
- `eas build --profile production --platform ios` (and android). expo-audio (voice notes) is bundled by the build.
- Apple Developer + Play Console: store listings, screenshots, privacy labels, signing.

## 7. Legal — drafts live, need review  **[You + solicitor]**
`/terms`, `/privacy`, `/community-guidelines`, `/driver-agreement`, `/restricted-goods` are drafted (entity: **Darren Fullerton Consultancy Ltd t/a OneShetland**) and linked in the footer. Have a solicitor review before launch. Replace `hello@oneshetland.com` if your contact address differs.

## 8. Operational  **[You]**
- Recruit a few Fetch drivers before launch (no drivers = no deliveries).
- Driver vetting: a process to check each driver's licence + goods-in-transit insurance (the apply form collects the declaration; you verify).

---

### Done in code today (no action needed)
- Fee model implemented + deployed (test mode).
- Push: 8 `notify-*` functions now respect per-module settings + quiet hours + logging (pending the SQL in §2).
- App: password-reset flow added; donation "cover the fee" toggle; debug logs removed.
- Web: error boundary; 5 legal pages + footer links.
