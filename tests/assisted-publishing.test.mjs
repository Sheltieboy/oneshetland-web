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
  test("nothing is emailed or notified", () => {
    for (const forbidden of ["postmark", "Postmark", "sendEmail", "notify-", "send-launch"]) {
      assert.ok(!all.includes(forbidden), `${forbidden} appears in the assisted-publishing web layer`);
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
