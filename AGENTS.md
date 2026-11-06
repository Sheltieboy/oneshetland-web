<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Launch readiness dashboard

`/admin/launch-readiness` (admins only) renders entirely from `lib/launch-readiness-data.ts`.
When a task materially changes launch readiness — in this repo or in `oneshetland-delivers` —
update that data file in the same task: status, evidence, nextAction, criticality, lastUpdated.
Do not edit the dashboard component to change what it says. The rules are in the file's header.
