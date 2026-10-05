#!/usr/bin/env node
/**
 * Launch Partner invitations are issued by the DATABASE (so only a hash is ever stored) — from the admin screen
 * (Admin → Business claims → "Launch invitations"), or from SQL:
 *
 *   select public.admin_issue_launch_invite('love-from-shetland', '<business id>', now() + interval '30 days');
 *
 * It returns the token ONCE. The link is  https://oneshetland.com/launch/<slug>?invite=<token>
 * Revoke:   select public.admin_revoke_launch_invite('love-from-shetland', 'reason');
 *
 * This script only prints those reminders; it generates and stores nothing.
 */
console.log(`Issue:  select public.admin_issue_launch_invite('<slug>', '<business id>', now() + interval '30 days');
Revoke: select public.admin_revoke_launch_invite('<slug>', '<reason>');
List:   select * from public.admin_list_launch_invites();
Or use Admin → Business claims → Launch invitations.`);
