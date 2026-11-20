<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Launch readiness dashboard

`/admin/launch-readiness` (admins only) renders entirely from `lib/launch-readiness-data.ts`.
When a task materially changes launch readiness — in this repo or in `oneshetland-delivers` —
update that data file in the same task: status, evidence, nextAction, criticality, lastUpdated.
Do not edit the dashboard component to change what it says. The rules are in the file's header.

# Editions must be photographic

Standing instruction (20 Nov 2026). Every OneShetland Edition must be visually rich and use genuine,
relevant photography — a strong photographic cover, imagery through the editorial pages, real people,
products and places. **An Edition is not visually complete if most of its pages are typography on a
solid background.**

When building a draft Edition, assume the owner has obtained image permissions for that draft; flag a
*specific* conflicting restriction by name rather than omitting photography. Never use unrelated stock,
fabricated products, or AI-generated representations of real businesses.

The full rules live in `oneshetland-delivers/editions/EDITIONS-DESIGN-RULES.md`; Edition drafts are built
in `oneshetland-delivers/editions/<slug>/`, not in this repo.

Component notes that matter when writing Edition page bodies:
- Every `:::` block, `figure` included, must be closed by a lone `:::`, or it swallows the rest of the page.
- Multi-word attribute values must be quoted: `label="Take a stall"`, not `label=Take a stall`.
- `.ed-eb__cards` paints its grid gaps, so an unfilled row renders as a solid block. Only multiples of
  six are clean at every width.
