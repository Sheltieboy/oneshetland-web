/**
 * Demo mode: a deployment made ONLY for showing a concept to a guest (a staging site with its own isolated database). One environment variable switches it on:
 * EDITIONS_DEMO_MODE=1. It is never set in production. When on:
 *  - every Editions page carries a permanent "unofficial concept, demonstration data" banner;
 *  - search engines are told to index nothing (robots and sitemap);
 *  - the few actions that could reach beyond the demo are refused on the server: inviting or removing team members, changing roles, asking for verification,
 *    connecting a payout account and buying packages. (Payments are separately off: demonstration transactions are pre-recorded, and the commerce switch is off.)
 * The sign-in, the database's own row-level security and every other safeguard are unchanged: demo mode only ever removes capability.
 */
export const isDemoMode = (): boolean => process.env.EDITIONS_DEMO_MODE === "1";
export const DEMO_BLOCKED = "This is a demonstration, so this action is switched off. Everything else is yours to explore.";
export const DEMO_BANNER_TEXT = "An unofficial concept with demonstration data. No real producer, member, payment or event is shown, and nothing here has been endorsed.";
