/**
 * Assisted Publishing — what the admin screens may and may not do.
 * Run: node --test tests/assisted-publishing.test.mjs
 *
 * The database proves the permissions (supabase/tests/assisted-publishing-phase1.node.test.ts). This
 * pins the things only the web layer can get wrong: the category and type lists silently drifting out
 * of step with the CHECK constraints they must satisfy, the state wording claiming more than it
 * knows, and this feature quietly acquiring a service key, an account or an email.
 *
 * Local only. No network, no database, no browser.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const SHAPE = read("lib/assisted/shape.ts");
const CLIENT = read("lib/assisted/client.ts");
const ACTIONS = read("app/admin/assisted/actions.ts");
const FORM = read("components/admin/assisted/AddOnBehalf.tsx");
const RECORDS = read("components/admin/assisted/AssistedRecords.tsx");
const MIGRATION = read("../oneshetland-be-edfinish/supabase/migrations/20270315000000_assisted_publishing_phase1.sql");

/** The two pure functions, re-created from the module's own source. */
const assistedState = (r) => {
  if (r.is_claimed) return `Managed by its owner${r.owner_name ? ` (${r.owner_name})` : ""}`;
  return r.is_active ? "OneShetland-managed · unclaimed · visible to the public" : "OneShetland-managed · unclaimed · not published";
};
const publicPath = (r) => {
  const ref = r.slug || r.subject_id;
  if (!ref) return null;
  return r.subject_kind === "hub" ? `/hubs/${ref}` : `/directory/${ref}`;
};
const listFrom = (name) => {
  const m = new RegExp(`${name}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\];`).exec(SHAPE);
  assert.ok(m, `${name} is gone from shape.ts`);
  return [...m[1].matchAll(/\["([a-z_]+)",/g)].map((x) => x[1]);
};

describe("the category and type lists must satisfy the database's own CHECK constraints", () => {
  test("every Directory category offered is one local_businesses_category_check allows", () => {
    // The allowed set, taken from production and pinned here so a drift fails loudly rather than at 3am.
    const allowed = ["food_drink", "retail", "services", "tourism", "accommodation", "other",
      "health_wellbeing", "arts_creative", "sport_fitness", "community_voluntary"];
    const offered = listFrom("BUSINESS_CATEGORIES");
    assert.equal(offered.length, allowed.length, `offered ${offered.length} categories, the constraint allows ${allowed.length}`);
    for (const c of offered) assert.ok(allowed.includes(c), `"${c}" is not an allowed category`);
  });

  test("every Hub type offered is one hubs_type_check allows", () => {
    const allowed = ["club", "sports", "youth", "hall", "charity", "society", "volunteer", "arts", "community", "other"];
    const offered = listFrom("HUB_TYPES");
    assert.equal(offered.length, allowed.length);
    for (const t of offered) assert.ok(allowed.includes(t), `"${t}" is not an allowed Hub type`);
  });

  test("the form offers exactly those lists, and does not hard-code its own", () => {
    assert.ok(FORM.includes("BUSINESS_CATEGORIES.map"), "the category list is not read from shape.ts");
    assert.ok(FORM.includes("HUB_TYPES.map"), "the Hub type list is not read from shape.ts");
  });
});

describe("the state line never claims more than it knows", () => {
  const cases = [
    [{ is_claimed: true, is_active: true, owner_name: "A real owner" }, /Managed by its owner \(A real owner\)/],
    [{ is_claimed: true, is_active: true, owner_name: null }, /^Managed by its owner$/],
    [{ is_claimed: false, is_active: true, owner_name: null }, /OneShetland-managed · unclaimed · visible/],
    [{ is_claimed: false, is_active: false, owner_name: null }, /unclaimed · not published/],
  ];
  for (const [row, expected] of cases) {
    test(`claimed=${row.is_claimed} active=${row.is_active} owner=${row.owner_name ?? "none"}`, () => {
      assert.match(assistedState(row), expected);
    });
  }
  test("an unclaimed record is never described as managed by anyone", () => {
    for (const active of [true, false]) {
      const s = assistedState({ is_claimed: false, is_active: active, owner_name: "Somebody" });
      assert.doesNotMatch(s, /Managed by its owner/, "an unclaimed record was described as owned");
    }
  });
});

describe("the public link points at the right place", () => {
  test("a Hub goes to /hubs, a listing to /directory", () => {
    assert.equal(publicPath({ subject_kind: "hub", slug: "burra-youth-club", subject_id: "x" }), "/hubs/burra-youth-club");
    assert.equal(publicPath({ subject_kind: "business", slug: "hamecooked", subject_id: "x" }), "/directory/hamecooked");
  });
  test("it falls back to the id when there is no slug, rather than linking nowhere", () => {
    assert.equal(publicPath({ subject_kind: "hub", slug: null, subject_id: "abc" }), "/hubs/abc");
  });
});

describe("this feature creates no account, sends nothing, and holds no service key", () => {
  const all = [CLIENT, ACTIONS, FORM, RECORDS].join("\n");
  test("no service key anywhere", () => {
    for (const forbidden of ["SERVICE_ROLE", "service_role", "SUPABASE_SERVICE", "service_key"]) {
      assert.ok(!all.includes(forbidden), `${forbidden} appears in the assisted-publishing web layer`);
    }
  });
  test("no account creation and no sign-up", () => {
    for (const forbidden of ["signUp", "admin.createUser", "inviteUserByEmail", "generateLink"]) {
      assert.ok(!all.includes(forbidden), `${forbidden} appears in the assisted-publishing web layer`);
    }
  });
  // Phase 2 adds an OPTIONAL invitation that an administrator may choose to email, so "this feature
  // can never send anything" is no longer the truth. What must still be true — and is the thing that
  // would actually hurt — is that CREATING a record emails nobody. So this now pins the creation
  // path precisely, rather than the whole feature loosely.
  test("creating a record emails nobody", () => {
    const creation = [FORM, CLIENT, SHAPE,
      ...ACTIONS.split(/export async function /).slice(1)
        .filter((b) => /^createAssisted|^editAssisted|^setAssistedRequest|^forgetAssistedContact/.test(b))].join("\n");
    for (const forbidden of ["postmark", "Postmark", "sendEmail", "notify-", "send-launch", "send-assisted", "functions.invoke"]) {
      assert.ok(!creation.includes(forbidden), `${forbidden} is reachable from the creation path`);
    }
    assert.match(FORM, /No account is created and nothing is emailed/, "the form must say so on the screen");
  });
  test("and the web still holds no mail transport of its own", () => {
    for (const forbidden of ["postmarkapp", "POSTMARK_API_KEY", "nodemailer", "sendgrid", "mailgun"]) {
      assert.ok(!all.toLowerCase().includes(forbidden.toLowerCase()),
        `${forbidden} appears in the assisted-publishing web layer — sending belongs to the Edge Function`);
    }
  });
  test("every action begins by requiring an administrator", () => {
    const exported = [...ACTIONS.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    assert.ok(exported.length >= 4, `expected the four actions, found ${exported.length}`);
    const bodies = ACTIONS.split(/export async function /).slice(1);
    for (const b of bodies) {
      assert.match(b.slice(0, 400), /await requireAdmin\(\)/, `an action does not call requireAdmin(): ${b.slice(0, 60)}`);
    }
  });
  test("each action calls one database function and never writes a table directly", () => {
    assert.ok(!ACTIONS.includes('.from("hubs")') && !ACTIONS.includes('.from("local_businesses")'),
      "an action writes a content table directly instead of going through the database function");
  });
});

describe("the duplicate step cannot be skipped by accident", () => {
  test("the form only sends confirm_duplicate from a checkbox the administrator ticks", () => {
    assert.match(FORM, /name="confirm_duplicate"[^>]*type="checkbox"|type="checkbox"[^>]*name="confirm_duplicate"/,
      "confirm_duplicate is not a checkbox the administrator must tick");
    assert.ok(!/confirm_duplicate"\s+defaultChecked/.test(FORM), "confirm_duplicate is ticked by default");
  });
  test("the candidates are shown before any confirmation is offered", () => {
    const i = FORM.indexOf("may already have");
    const j = FORM.indexOf('name="confirm_duplicate"');
    assert.ok(i > -1 && j > i, "the confirmation appears without the candidates above it");
  });
  test("and the database refuses by default — the server, not the form, is the gate", () => {
    assert.match(MIGRATION, /if not p_confirm_duplicate then/, "the migration no longer checks for duplicates by default");
    assert.match(MIGRATION, /p_confirm_duplicate\s+boolean default false/, "confirmation defaults to true in the database");
  });
});

describe("an unclaimed Hub does not pretend an organisation is behind it", () => {
  const HUBPAGE = read("app/hubs/[id]/page.tsx");
  test("the join / membership panel is shown only once the Hub is claimed", () => {
    assert.match(HUBPAGE, /\{!hub\.is_claimed \?/, "the Hub page no longer branches on is_claimed");
    const gate = HUBPAGE.indexOf("!hub.is_claimed ?");
    const panel = HUBPAGE.indexOf("<HubMembershipPanel");
    assert.ok(gate > -1 && panel > gate, "HubMembershipPanel is not inside the claimed branch");
  });
  test("an unclaimed Hub says plainly who maintains it, and claims no verification", () => {
    assert.match(HUBPAGE, /Maintained by OneShetland/);
    assert.match(HUBPAGE, /Nobody from the organisation manages it yet/);
    // The verified tick must still depend only on is_verified, which the database forces false while unclaimed.
    assert.match(HUBPAGE, /hub\.is_verified && <span/);
  });
  test("is_claimed is actually read from the database, or the gate would be undefined", () => {
    const DATA = read("lib/hubs-data.ts");
    assert.match(DATA, /is_claimed: boolean;/, "the Hub type has no is_claimed");
    assert.match(DATA, /is_verified, is_claimed, memberships_enabled/, "is_claimed is not in the public column list");
  });
});

describe("an administrator can maintain an unclaimed record, and only an unclaimed one", () => {
  test("the edit form is offered for unclaimed records and withheld once claimed", () => {
    assert.match(RECORDS, /!r\.is_claimed && editing !== r\.subject_id/, "the Edit button is not gated on is_claimed");
    // Phase 2: the sentence now carries the one exception, which is the owner's own permission.
    assert.match(RECORDS, /Claimed — only its owner can edit it, unless they ask us to help/,
      "a claimed record does not say why it cannot be edited");
  });
  test("blank means keep, and the screen says so — it matches what the database does", () => {
    assert.match(RECORDS, /Leave a field blank to keep what is already there/);
    assert.ok(!/blank to clear/i.test(RECORDS), "the screen promises clearing, which the function does not do");
    assert.match(MIGRATION, /case when p_description is null then description else/, "NULL no longer means leave-alone in the database");
  });
  test("the edit action cannot touch the owner, the claim or entitlement", () => {
    for (const forbidden of ["owner_id", "is_claimed", "subscription_tier", "is_verified", "payout_enabled"]) {
      assert.ok(!ACTIONS.includes(forbidden), `${forbidden} appears in the assisted actions`);
    }
  });
  test("and the database refuses an administrator the moment it is claimed", () => {
    assert.match(MIGRATION, /That listing has been claimed by its owner, so only they can edit it\./);
    assert.match(MIGRATION, /That Hub has been claimed by its owner, so only they can edit it\./);
  });
});

describe("the migration keeps the promises this screen makes", () => {
  test("it creates content with no owner", () => {
    assert.match(MIGRATION, /null, null, false, false, coalesce\(p_publish, true\), 'free', 'assisted'/, "the business insert no longer writes a NULL owner");
    assert.match(MIGRATION, /\(null, v_name, v_slug, p_type/, "the hub insert no longer writes a NULL owner");
  });
  test("an unclaimed Hub is barred from owner-only capabilities by a CHECK", () => {
    assert.match(MIGRATION, /hubs_unclaimed_holds_no_owner_powers/);
    for (const col of ["memberships_enabled", "payout_enabled", "stripe_account_id", "is_verified", "events_auto_approve"]) {
      assert.ok(MIGRATION.includes(col), `${col} is not covered by the unclaimed-Hub guard`);
    }
  });
  test("hubs.is_claimed is derived, public and not client-writable", () => {
    assert.match(MIGRATION, /new\.is_claimed := new\.owner_id is not null;/, "is_claimed is no longer derived from owner_id");
    assert.match(MIGRATION, /grant select \(is_claimed\) on public\.hubs to anon, authenticated;/, "is_claimed is not public");
    assert.ok(!/grant update \(is_claimed\)/.test(MIGRATION), "is_claimed was made client-writable");
  });

  test("the request details table has RLS on and no policy", () => {
    assert.match(MIGRATION, /alter table public\.assisted_publications enable row level security/);
    assert.match(MIGRATION, /revoke all on public\.assisted_publications from anon, authenticated/);
    assert.ok(!/create policy[^;]*assisted_publications/.test(MIGRATION), "a policy was added to assisted_publications");
  });
  test("it sends no email and creates no account", () => {
    for (const forbidden of ["net.http", "pg_net", "auth.users (", "insert into auth."]) {
      assert.ok(!MIGRATION.includes(forbidden), `${forbidden} appears in the migration`);
    }
  });
});
