# Manual tests — the parts automation can't reach

**All of these run in Stripe test mode.** No real money moves. Card `4242 4242 4242 4242`,
any future expiry, any CVC, any postcode.

66 automated checks cover the logic — pure-logic scenarios plus
`oneshetland-delivers/supabase/scripts/verify-metering.sql` for the SQL. What they cannot
cover is anything needing live Stripe or Postmark state. That's these four.

Every test says what to do, what should happen, **and how you'd know it silently didn't** —
because the failure mode that survives testing is the one that looks like success.

---

## Before you start

| Check | Where |
|---|---|
| `stripe.price.local_pro` = `price_1U52dsCCZSiMQBCgxAtKpCYN` | `/admin/config` |
| `stripe.price.local_premium` = `price_1U52cgCCZSiMQBCgEeyHtDLG` | `/admin/config` |
| `stripe.price.local_premium_annual` = `price_1U52ewCCZSiMQBCgJri1DZwO` | `/admin/config` |
| `stripe.price.booking_meter` = `price_1U5WRgCCZSiMQBCgPjPIcvyl` | `/admin/config` |
| Webhook endpoint live, pointing at `…/functions/v1/stripe-webhook` | Stripe → Developers → Webhooks |

If the webhook isn't wired in test mode, **every one of these tests will appear to fail**
for the same reason: Stripe does the right thing and your database never hears about it.
Check that first.

---

## Test 1 — Metered bookings, end to end

**This is the one that has never run.** Everything up to the Stripe call is proven; the
call itself has never executed against a real subscription.

### Setup

1. Sign in and create a business (or use an existing unclaimed one you own).
2. Go to `/business/<id>/manage/billing` → **Upgrade to Pro · £12/mo**. Pay with the test card.
3. **Verify the subscription has TWO items** — this is the bit that was broken:
   Stripe → Customers → your customer → the subscription. You should see **£12.00/month**
   *and* a metered **Bookings** line.

> ⚠️ If there's only one item, the meter will never bill and nothing will error. Stop here
> and check `stripe.price.booking_meter` is set — that's the single most likely cause.

### Run

4. Set up a bookable service: **Services** → add one. Then **Availability** → open some hours.
5. From another account (or a private window), book that service **three times**.
6. Trigger the meter. Either wait for `reminder-runner`'s schedule, or invoke it directly:

```bash
curl -X POST "https://nkrtmakxygkvxuxriiil.supabase.co/functions/v1/meter-bookings" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### Expected

- Response: `{"ok":true,"billed":1,"units":3,...}`
- Stripe → your subscription → **Usage** shows **3** against the Bookings meter
- The billing screen shows *"3 bookings this month · £2.85 in booking fees"*

### How you'd know it silently didn't work

- `"skipped": 3` instead of `"units": 3` → the meter item isn't on the subscription (step 3)
- `"units": 3` but Stripe shows no usage → the meter event was posted to the wrong meter;
  check the Price's meter matches the one named `booking`
- Run the curl **twice**. The second must return `"units": 0`. If it returns 3 again,
  idempotency is broken and you'd be double-billing.

### The cap

7. Make **20 more** bookings and re-run. Total billable must stop at **17** for the month,
   and the billing screen should switch to *"You've hit the monthly cap…"*. Stripe usage
   must read 17, never 18 — 18 would mean a Pro business paying £29.10 against Premium's £29.

---

## Test 2 — Event update reaches a ticket buyer by email

The gap this closed: a cancelled event reaching nobody. Push reaches no one today (the app
is unpublished, so `push_tokens` is empty), so **email is the only channel that works**.

### Setup

1. As a business, create an event with a paid ticket type (£5 is fine).
2. From a **different account with a real email address you can check**, buy one ticket.
   Confirm the ticket appears under `/account/tickets`.

### Run

3. As the organiser: **Events → your event → post an update**, kind **Cancellation**.

### Expected

- The buyer receives an email titled *"<event> has been cancelled"*
- It names the organiser, the original date and venue, and explains refunds come from the
  organiser with OneShetland as backstop
- `/notifications` on the buyer's account also shows it

### How you'd know it silently didn't work

- No email but the inbox notification appears → the push/inbox path works and the email path
  didn't. Check Supabase → Edge Functions → `notify-event-update` logs for
  `email failed for <uid>`, and check the `events.cancelled` template is **enabled** in
  `/admin/email`.
- Nothing at all → the function didn't fire. Check `event_updates` actually got a row.
- Also post a non-cancellation update and confirm it uses the *other* template
  (`events.update`) with a different subject line — one template answering for both would be
  a silent regression.

---

## Test 3 — Annual Premium, and switching to it

### Setup / run

1. On a business already on **monthly Premium**, go to billing → **Switch to yearly · £290/yr**.
2. Read the confirmation. It should quote a **prorated amount**, and word a credit as a credit
   rather than calling it a charge.
3. Confirm.

### Expected

- Stripe subscription now on the £290 annual price
- **The business is still Premium in your database** — this is the bug that existed before:
  the webhook only recognised the monthly Premium price, so an annual subscriber would have
  been silently dropped to Pro
- Renewal date roughly 12 months out
- The billing screen now says *"You're on yearly billing"* and offers no switch button
- `/admin/nfc` lists the business under **To post**, badged **Yearly — tile included**

### How you'd know it silently didn't work

```sql
select name, subscription_tier, subscription_until
from local_businesses where id = '<business id>';
```

`subscription_tier` must still read `premium`. If it reads `pro` or `free`, the webhook
didn't recognise the annual price — check `stripe.price.local_premium_annual` is set.

4. **Switch back to monthly** and confirm the proration reads as a credit, and the tier holds.

---

## Test 4 — An unrecognised price must not downgrade anyone

This one deliberately breaks things, and it's the most valuable test here: it proves a
paying business can't be silently stripped of its listing.

### Run

1. In Stripe, create a throwaway Price on the Local Pro product — any amount, monthly.
   **Do not** put it in `/admin/config`.
2. Take a business that's currently on **Premium** and, in the Stripe dashboard, change its
   subscription to that unknown price.

### Expected

- The business **stays Premium** in your database
- Supabase → Edge Functions → `stripe-webhook` logs show
  `ACTIVE subscription … on unrecognised price … tier left unchanged`

### Why it matters

Before the fix, an unmatched price fell through to `free`: Stripe would take the money and
OneShetland would remove the listing. Adding a Price in the dashboard was enough to cause it.

3. Now **cancel** that subscription. The business *should* drop to `free` — an inactive
   subscription is a real downgrade, and it's important that the safety net doesn't also
   prevent legitimate ones.

### Cleanup

Archive the throwaway Price and put the business back on its proper subscription.

---

## After all four

```sql
-- No business should be left mid-test.
select name, subscription_tier, subscription_until, stripe_subscription_id
from local_businesses
where stripe_subscription_id is not null
order by name;
```

Cancel any test subscriptions in Stripe, and delete test customers. Leftover test
subscriptions were what made the earlier state confusing — Stripe showed active
subscriptions while the database showed nobody on a paid tier.
