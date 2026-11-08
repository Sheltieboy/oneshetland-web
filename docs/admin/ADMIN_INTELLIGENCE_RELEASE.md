# Admin Intelligence: release runbook

Prepared 8 Nov 2026. Everything below is ready; **nothing has been run against production.** Total time at the Mac: about 10 minutes. Steps marked **YOU** need your own Terminal (the Supabase CLI refuses hosted changes from Claude). Everything else Claude does or checks.

## What is being released

| Part | Where | Ref |
|---|---|---|
| Database: 2 tables, 5 functions (additive; nothing existing changes) | backend worktree `/Users/darrenfullerton/Claude/oneshetland-be-admin-intel`, branch `admin-intel-be` | `0952c6b` (migration `20261231000000_admin_intelligence.sql`) |
| Website: `/admin/intelligence` + Useful Actions on `/admin` | web worktree `/Users/darrenfullerton/Claude/oneshetland-web-admin-intel`, branch `admin-intel-web` | tip of the branch (see `git log -1`); fast-forward from `origin/main` `5729f2d` |

Both branches are fully committed with clean working trees. Admin-only: no change is visible to members or to signed-out visitors.

## State verified on 8 Nov 2026 (read-only)

- `supabase migration list --linked`: local and remote match through `20261230110000`; the only difference is `20261231000000`.
- `supabase db push --dry-run --skip-vault`: would push exactly **one** migration, `20261231000000_admin_intelligence.sql`.
- None of the new tables or functions exist in production. `20261130000000` (analytics accuracy) **is** applied, so the existing Analytics page is unaffected.
- Tests: backend isolated 31/31 (new) + 14/14 (analytics regression); web 22/22 (new) and 57/57 with existing admin tests; `tsc` clean; `next build --webpack` compiles and generates all 31 pages with `/admin/intelligence` present.
- Remote web `main` was still `5729f2d`.

## Steps

### 0. Pre-flight (Claude, read-only, ~1 min)
Tell Claude "run the Admin Intelligence pre-flight". Claude re-runs `migration list --linked` and `db push --dry-run`, and checks `origin/main` is still `5729f2d`. **Stop if** the dry run lists anything other than `20261231000000`, or `main` has moved.

### 1. Apply the migration (YOU, ~1 min)
Avoid :15 to :20 past 00, 03, 06, 09, 12, 15, 18 and 21 UTC (council jobs sync holds locks; a clash just fails and rolls back, so retry).

```bash
cd /Users/darrenfullerton/Claude/oneshetland-be-admin-intel
supabase db push --skip-vault --project-ref nkrtmakxygkvxuxriiil
```

`--skip-vault` is deliberate. Confirm the prompt lists only `20261231000000_admin_intelligence.sql`. If it lists anything else, answer no and tell Claude.

### 2. Post-check (Claude, read-only, ~1 min)
Tell Claude "migration applied". Claude runs `supabase/production/post-checks/admin-intelligence.post-check.sql` and expects: `tables 2`, `functions 5`, `rls_on 2`, all four `*_cannot_run` / `*_not_granted` / `*_closed` flags `true`, `migration_registered 1`, `existing_analytics_intact true`, `new_table_rows 0`. **Stop and roll back (below) if any differ.**

### 3. Build once more and publish the website (Claude, after your OK, ~4 min)
Claude runs `next build --webpack` in the web worktree (needs normal internet for Google Fonts), then pushes with `git push origin admin-intel-web:main` (a fast-forward; no force). Netlify builds and publishes in about 2 minutes. Safety net: **Netlify, Deploys, the build for `main@5729f2d`, "Publish deploy"** reverts the site instantly.

### 4. First-run check (YOU on your phone or Mac, signed in as `darren@oneshetland.com`, ~3 min)
1. `/admin`: the key performance summary, then **Useful Actions**, appear above "Needs review".
2. Tap **Admin Intelligence** in the sidebar (or `/admin/intelligence`): try all six tabs and 7 / 30 / 90 days.
3. On any Useful Action tap **Snooze 7 days**; it disappears. (Undo: tell Claude, or use the reopen below.)
4. Signed in as an ordinary account (`darren@darrenfullerton.com`), `/admin/intelligence` should send you away from the admin area.

Claude then re-checks as an anonymous visitor (`/admin/intelligence` redirects to sign-in) and confirms the public site is unchanged.

### 5. Housekeeping (Claude, no urgency)
Update the registered-migrations snapshot and memory notes, and leave the branches for merging after launch.

## Rollback

| Layer | Action | Effect |
|---|---|---|
| Website | Netlify "Publish deploy" on `main@5729f2d`, or `git revert d97e6c7..HEAD` on the branch and push | Admin pages go back to the old dashboard |
| Database | `supabase db query --linked -f supabase/rollbacks/20261231000000_admin_intelligence.rollback.sql`, then `supabase migration repair --status reverted 20261231000000` (YOU, from the backend worktree) | Drops the 2 tables and 5 functions. Only Useful Actions history is lost. Nothing else depends on them. |
| Just reset one action | Claude runs `delete from admin_action_state where action_key = '<key>'` after your OK | The action reappears |

The website degrades safely if the database part is missing (it shows "not available"), so a partial release is harmless.

## Known limits (accepted, documented in the report)

Not measured: upgrades/downgrades history, listing last-updated, onboarding drop-off, notification opens, job-apply funnel. No new tracking is switched on. Thresholds in `admin_intel_rules_raw()` (8 events in 14 days, 5 push errors, 25 unclaimed, 3-day claims) are judgement calls and can be tuned later.

## One thing outside this release

A private page holding this migration's SQL was published at `https://claude.ai/artifact/9hFkP3kaAjPGNMjEmzJRL3` for a phone-based route you decided against. It contains no secrets. Ask Claude to delete it whenever you like.
