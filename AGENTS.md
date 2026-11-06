<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Launch readiness dashboard

`/admin/launch-readiness` (admins only) renders entirely from `lib/launch-readiness-data.ts`.
When a task materially changes launch readiness — in this repo or in `oneshetland-delivers` —
update that data file in the same task: status, evidence, nextAction, criticality, lastUpdated.
Do not edit the dashboard component to change what it says. The rules are in the file's header.
