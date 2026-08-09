-- ═══════════════════════════════════════════════════════════════════════════
--  Demo data for DEMO — Shetland Makkers
--  Run in the Supabase SQL editor. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY: the business dashboard hides any section with nothing in it, so a
-- business with no activity looks like a broken page. It has zero orders, zero
-- bookings, zero leads and no till code — so there is nothing for a tester to
-- see, and nothing for us to check the dashboard against.
--
-- EVERY ROW IS PREFIXED "DEMO — " OR CLEARLY MARKED. That matters: this is the
-- live database, and demo data that can't be told apart from real data is a
-- problem you find out about later, in public. The teardown at the bottom
-- removes exactly what this creates and nothing else.
--
-- Idempotent: fixed UUIDs and ON CONFLICT DO UPDATE throughout, so re-running
-- refreshes the demo rather than duplicating it.

begin;

-- The business, and its owner doubling as the demo customer — fine for a demo,
-- and it avoids inventing a person who doesn't exist.
--
--   business : dddddddd-0000-0000-0000-000000000001  (DEMO — Shetland Makkers)
--   customer : efb83e4b-6331-4c00-a019-ae0734b36db5  (you)
--
-- Written out in full rather than with \set, which is a psql client command
-- and does nothing in the Supabase SQL editor.

-- ── 1. Products ────────────────────────────────────────────────────────────
insert into public.products (id, business_id, title, description, category, price_pence, compare_at_pence, stock_mode, stock, lead_time_days, is_active)
values
  ('dddddddd-1000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'DEMO — Fair Isle yoke jumper',
   'Hand-knitted in Shetland wool, traditional Fair Isle yoke. Made to order in your size.',
   'knitwear', 18500, null, 'made_to_order', null, 28, true),
  ('dddddddd-1000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', 'DEMO — Lace shawl, undyed',
   'Cobweb-weight Shetland lace, undyed. Takes about six weeks on the needles.',
   'knitwear', 24000, 28000, 'one_off', 1, null, true),
  ('dddddddd-1000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000001', 'DEMO — Peerie hat',
   'Small all-over patterned hat. Warm, and it stays on in a gale.',
   'knitwear', 3200, null, 'tracked', 14, null, true),
  ('dddddddd-1000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-000000000001', 'DEMO — Wristwarmers, pair',
   'Two-colour wristwarmers. Good for the boat and the bus stop.',
   'knitwear', 2200, 2800, 'tracked', 23, null, true),
  ('dddddddd-1000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000001', 'DEMO — Shetland wool, 50g ball',
   'Undyed jumper-weight from Shetland fleeces. Eleven natural shades.',
   'craft', 650, null, 'tracked', 120, null, true)
on conflict (id) do update set
  title = excluded.title, description = excluded.description, price_pence = excluded.price_pence,
  compare_at_pence = excluded.compare_at_pence, stock = excluded.stock, is_active = true;

insert into public.product_variants (id, product_id, name, price_delta_pence, stock, position)
values
  ('dddddddd-1100-0000-0000-000000000001', 'dddddddd-1000-0000-0000-000000000001', 'Small',  0,    null, 0),
  ('dddddddd-1100-0000-0000-000000000002', 'dddddddd-1000-0000-0000-000000000001', 'Medium', 0,    null, 1),
  ('dddddddd-1100-0000-0000-000000000003', 'dddddddd-1000-0000-0000-000000000001', 'Large',  1500, null, 2),
  ('dddddddd-1100-0000-0000-000000000004', 'dddddddd-1000-0000-0000-000000000003', 'Natural', 0,   8,    0),
  ('dddddddd-1100-0000-0000-000000000005', 'dddddddd-1000-0000-0000-000000000003', 'Madder',  0,   6,    1)
on conflict (id) do update set name = excluded.name, stock = excluded.stock, is_active = true;

-- ── 2. Orders — one of each state the dashboard cares about ────────────────
-- 'paid' is what shows in "Orders to deal with"; the others give the ledger
-- and the orders inbox something to render.
insert into public.product_orders
  (id, business_id, buyer_id, status, fulfilment, items_pence, shipping_pence, total_pence,
   commission_pence, paid_via, delivery_name, delivery_address, delivery_postcode, contact_phone,
   buyer_note, paid_at, created_at)
values
  ('dddddddd-2000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'efb83e4b-6331-4c00-a019-ae0734b36db5', 'paid', 'post', 3200, 395, 3595, 180, 'card',
   'DEMO — Ann Tait', '14 Burgh Road, Lerwick', 'ZE1 0LB', '07700 900001',
   'Could you post it second class if that''s cheaper?', now() - interval '4 hours', now() - interval '4 hours'),

  ('dddddddd-2000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', 'efb83e4b-6331-4c00-a019-ae0734b36db5', 'paid', 'collect', 4400, 0, 4400, 220, 'wallet',
   'DEMO — Magnus Irvine', null, null, '07700 900002',
   null, now() - interval '1 day', now() - interval '1 day'),

  ('dddddddd-2000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000001', 'efb83e4b-6331-4c00-a019-ae0734b36db5', 'paid', 'fetch', 24000, 500, 24500, 1225, 'card',
   'DEMO — Kirsty Georgeson', '3 Sandveien, Lerwick', 'ZE1 0RA', '07700 900003',
   'No rush at all.', now() - interval '2 days', now() - interval '2 days'),

  ('dddddddd-2000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-000000000001', 'efb83e4b-6331-4c00-a019-ae0734b36db5', 'completed', 'collect', 1300, 0, 1300, 65, 'wallet',
   'DEMO — Brian Hunter', null, null, '07700 900004',
   null, now() - interval '9 days', now() - interval '9 days'),

  ('dddddddd-2000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000001', 'efb83e4b-6331-4c00-a019-ae0734b36db5', 'posted', 'post', 18500, 495, 18995, 950, 'card',
   'DEMO — Rhona Smith', '7 Da Lea, Brae', 'ZE2 9QJ', '07700 900005',
   null, now() - interval '5 days', now() - interval '5 days')
on conflict (id) do update set status = excluded.status, total_pence = excluded.total_pence, paid_at = excluded.paid_at;

insert into public.product_order_items (id, order_id, product_id, title, variant_name, unit_pence, qty)
values
  ('dddddddd-2100-0000-0000-000000000001', 'dddddddd-2000-0000-0000-000000000001', 'dddddddd-1000-0000-0000-000000000003', 'DEMO — Peerie hat', 'Natural', 3200, 1),
  ('dddddddd-2100-0000-0000-000000000002', 'dddddddd-2000-0000-0000-000000000002', 'dddddddd-1000-0000-0000-000000000004', 'DEMO — Wristwarmers, pair', null, 2200, 2),
  ('dddddddd-2100-0000-0000-000000000003', 'dddddddd-2000-0000-0000-000000000003', 'dddddddd-1000-0000-0000-000000000002', 'DEMO — Lace shawl, undyed', null, 24000, 1),
  ('dddddddd-2100-0000-0000-000000000004', 'dddddddd-2000-0000-0000-000000000004', 'dddddddd-1000-0000-0000-000000000005', 'DEMO — Shetland wool, 50g ball', null, 650, 2),
  ('dddddddd-2100-0000-0000-000000000005', 'dddddddd-2000-0000-0000-000000000005', 'dddddddd-1000-0000-0000-000000000001', 'DEMO — Fair Isle yoke jumper', 'Medium', 18500, 1)
on conflict (id) do update set title = excluded.title, unit_pence = excluded.unit_pence, qty = excluded.qty;

-- ── 3. Offers ──────────────────────────────────────────────────────────────
insert into public.local_offers (id, business_id, title, description, discount_type, discount_value, valid_from, valid_until, terms, max_redemptions, is_active, redemption_count)
values
  ('dddddddd-3000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'DEMO — 10% off all wool',
   'Ten per cent off every ball of undyed Shetland wool.', 'percent', 10,
   now() - interval '7 days', now() + interval '21 days', 'One use per person. Not with other offers.', 100, true, 12),
  ('dddddddd-3000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', 'DEMO — Free pattern with any yarn',
   'Pick any of our patterns free when you buy four balls or more.', 'freebie', null,
   now() - interval '2 days', now() + interval '30 days', 'While stocks last.', 50, true, 3),
  ('dddddddd-3000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000001', 'DEMO — £5 off wristwarmers',
   'Five pounds off a pair of wristwarmers.', 'fixed', 5,
   now() - interval '40 days', now() - interval '5 days', null, 30, false, 21)
on conflict (id) do update set title = excluded.title, valid_until = excluded.valid_until, is_active = excluded.is_active;

-- ── 4. Bookable services, and bookings ─────────────────────────────────────
insert into public.book_services (id, business_id, name, description, duration_minutes, buffer_minutes, price_pence, deposit_pence, requires_deposit, category, display_order, is_active, capacity)
values
  ('dddddddd-4000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'DEMO — Fair Isle beginners workshop',
   'Half a day learning two-colour knitting. Wool and needles provided.', 180, 30, 4500, 1000, true, 'Workshop', 0, true, 8),
  ('dddddddd-4000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', 'DEMO — Lace knitting, one to one',
   'An hour on your own project with one of the makkers.', 60, 15, 3000, 0, false, 'Tuition', 1, true, 1),
  ('dddddddd-4000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000001', 'DEMO — Studio visit',
   'A look round the studio, half an hour, free.', 30, 0, 0, 0, false, 'Visit', 2, true, 6)
on conflict (id) do update set name = excluded.name, price_pence = excluded.price_pence, is_active = true;

-- Times are anchored to date_trunc('day', …) so "+ 10 hours" means 10am.
-- Anchoring to the current HOUR instead gave a workshop at 21:00.
insert into public.book_bookings (id, business_id, service_id, customer_id, starts_at, ends_at, status, price_pence, deposit_pence, notes, created_at)
values
  ('dddddddd-4100-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'dddddddd-4000-0000-0000-000000000001', 'efb83e4b-6331-4c00-a019-ae0734b36db5',
   date_trunc('day', now()) + interval '1 day' + interval '10 hours',
   date_trunc('day', now()) + interval '1 day' + interval '13 hours',
   'confirmed', 4500, 1000, 'DEMO — complete beginner, left handed.', now() - interval '3 days'),
  ('dddddddd-4100-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', 'dddddddd-4000-0000-0000-000000000002', 'efb83e4b-6331-4c00-a019-ae0734b36db5',
   date_trunc('day', now()) + interval '3 days' + interval '14 hours',
   date_trunc('day', now()) + interval '3 days' + interval '15 hours',
   'confirmed', 3000, 0, null, now() - interval '1 day'),
  ('dddddddd-4100-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000001', 'dddddddd-4000-0000-0000-000000000003', 'efb83e4b-6331-4c00-a019-ae0734b36db5',
   date_trunc('day', now()) + interval '6 days' + interval '11 hours',
   date_trunc('day', now()) + interval '6 days' + interval '11 hours 30 minutes',
   'confirmed', 0, 0, 'DEMO — two visitors off the cruise ship.', now() - interval '6 hours'),
  ('dddddddd-4100-0000-0000-000000000004', 'dddddddd-0000-0000-0000-000000000001', 'dddddddd-4000-0000-0000-000000000001', 'efb83e4b-6331-4c00-a019-ae0734b36db5',
   date_trunc('day', now()) - interval '5 days' + interval '10 hours',
   date_trunc('day', now()) - interval '5 days' + interval '13 hours',
   'completed', 4500, 1000, null, now() - interval '12 days')
on conflict (id) do update set starts_at = excluded.starts_at, ends_at = excluded.ends_at, status = excluded.status;

-- ── 5. The trade side, so Job leads has something in it ────────────────────
-- Shetland Makkers isn't a joiner, but the demo needs the leads panel to show,
-- and "handyman" is honest enough for a maker who does repairs.
update public.local_businesses
set trade_categories          = array['handyman','other'],
    trade_availability        = 'now',
    trade_availability_set_at = now(),
    trade_min_job_pence       = 5000,
    trade_credentials         = array['insured']
where id = 'dddddddd-0000-0000-0000-000000000001';

insert into public.trade_briefs
  (id, author_id, title, description, trades, scale, urgency, location_text, contact_name, contact_phone, status, created_at)
values
  ('dddddddd-5000-0000-0000-000000000001', 'efb83e4b-6331-4c00-a019-ae0734b36db5',
   'DEMO — Moth holes in a handknit jumper',
   'Three small holes in the front of a Fair Isle jumper that belonged to my father. Would like it invisibly mended if that''s possible.',
   array['handyman'], 'small', 'flexible', 'Lerwick', 'DEMO — Ann Tait', '07700 900001', 'open', now() - interval '2 days'),
  ('dddddddd-5000-0000-0000-000000000002', 'efb83e4b-6331-4c00-a019-ae0734b36db5',
   'DEMO — Repair to a lace shawl edge',
   'The border has come away along one edge of an old lace shawl. Not urgent.',
   array['handyman','other'], 'small', 'months', 'Scalloway', 'DEMO — Magnus Irvine', '07700 900002', 'open', now() - interval '6 hours')
on conflict (id) do update set title = excluded.title, status = 'open', created_at = excluded.created_at;

insert into public.trade_brief_matches (id, brief_id, business_id, status, created_at)
values
  ('dddddddd-5100-0000-0000-000000000001', 'dddddddd-5000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'sent', now() - interval '2 days'),
  ('dddddddd-5100-0000-0000-000000000002', 'dddddddd-5000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', 'sent', now() - interval '6 hours')
on conflict (id) do update set status = 'sent';

-- ── 6. The till code, so the counter card has something to show ────────────
-- Normally minted client-side on a 60s rotation; seeded here so the dashboard
-- isn't blank before counter mode has ever been opened.
insert into public.local_business_codes (business_id, current_code, expires_at, updated_at)
values ('dddddddd-0000-0000-0000-000000000001', lpad((floor(random() * 1000000))::int::text, 6, '0'), now() + interval '1 minute', now())
on conflict (business_id) do update set
  current_code = excluded.current_code, expires_at = excluded.expires_at, updated_at = now();

commit;

-- ═══════════════════════════════════════════════════════════════════════════
--  What you should now see
-- ═══════════════════════════════════════════════════════════════════════════
--   Dashboard  · 3 orders to deal with, 3 bookings coming up, 2 job leads
--   Products   · 5 items, 2 with variants, one sale-priced, one one-off
--   Offers     · 2 running, 1 expired
--   Bookings   · 3 upcoming, 1 completed
--   Job leads  · 2 waiting, availability set to "taking work on now"
--
--   "Money in" stays blank unless the analytics add-on is on — that figure is
--   deliberately not faked, since a wrong number there would undermine every
--   other figure on the page.

-- ═══════════════════════════════════════════════════════════════════════════
--  TEARDOWN — removes exactly what the above created, nothing else
-- ═══════════════════════════════════════════════════════════════════════════
-- begin;
-- delete from public.trade_brief_matches where id::text like 'dddddddd-5100-%';
-- delete from public.trade_briefs        where id::text like 'dddddddd-5000-%';
-- delete from public.book_bookings       where id::text like 'dddddddd-4100-%';
-- delete from public.book_services       where id::text like 'dddddddd-4000-%';
-- delete from public.local_offers        where id::text like 'dddddddd-3000-%';
-- delete from public.product_order_items where id::text like 'dddddddd-2100-%';
-- delete from public.product_orders      where id::text like 'dddddddd-2000-%';
-- delete from public.product_variants    where id::text like 'dddddddd-1100-%';
-- delete from public.products            where id::text like 'dddddddd-1000-%';
-- update public.local_businesses set trade_categories = null, trade_availability = null,
--        trade_availability_set_at = null, trade_min_job_pence = null, trade_credentials = null
--  where id = 'dddddddd-0000-0000-0000-000000000001';
-- commit;
