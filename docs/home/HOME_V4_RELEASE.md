# Homepage V4: release runbook

Branch `home-v4-live` (from `origin/main` c35a609). Backend: `home-announcements-be` in `/Users/darrenfullerton/Claude/oneshetland-be-home-announcements` (one new migration). Nothing has been applied, pushed or deployed.

## What is released
New in Shetland this week, What's happening (+ Tomorrow), Latest from OneShetland (admin-managed), My Saved inside For you, five contribution cards, and Admin → Announcements.

## Order
1. **Database first (you, from the backend worktree):** `supabase db push --skip-vault --project-ref nkrtmakxygkvxuxriiil`. Exactly one migration: `20270101000000_home_announcements.sql` (new table + 2 policies + 1 function; nothing existing changes). Post-check: `supabase/production/post-checks/home-announcements.post-check.sql`. Rollback: `supabase/rollbacks/20270101000000_home_announcements.rollback.sql` then `supabase migration repair --status reverted 20270101000000`.
2. **Website:** `git push origin home-v4-live:main` (fast-forward). Netlify publishes in about 2 minutes.
3. **Verify live:** homepage sections and links; `/admin/announcements` as an admin (create a draft, publish, see it on `/`, withdraw); signed out `/admin/announcements` redirects to sign-in.

The web code degrades safely if the table is missing: Latest simply does not appear and the admin page says it is not set up. So the order is not dangerous either way.

## Rollback
Web: Netlify, Deploys, publish the build for `main@c35a609`. Database: as above (only announcements are lost).

## Switches that already exist and are respected
`EVENT_FRONT_DOOR` (Add an Event card appears only when it is exactly "on"); `saved_enabled()` (My Saved items in For you); `homepage_excluded` (business exclusion); Premium reserved slots and rotation (unchanged).
