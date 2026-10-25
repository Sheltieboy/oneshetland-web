/**
 * Fetch v2 web — the shared product contract (Step 13). lib/fetch-api.ts and lib/fetch/{present,flow,scenarios}.ts are shared byte-for-byte
 * with the app (oneshetland-delivers, branch fetch-v2-mobile). lib/fetch/contract.json records their hashes in BOTH repos, so a change made
 * on one side only is caught here even when the app checkout isn't next to this one; when it is, the two contracts must match too.
 * Run: node --test tests/fetch-contract.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const APP = process.env.FETCH_APP_ROOT ?? join(root, "..", "oneshetland-mobile-fetch-v2");
const contract = JSON.parse(readFileSync(join(root, "lib/fetch/contract.json"), "utf8"));

test("every shared module matches the recorded contract hash", () => {
  for (const [f, hash] of Object.entries(contract.files)) {
    assert.equal(createHash("sha256").update(readFileSync(join(root, f))).digest("hex"), hash, `${f} changed — make the same change in the app, then update contract.json in both`);
  }
  assert.deepEqual(Object.keys(contract.files).sort(), ["lib/fetch-api.ts", "lib/fetch/flow.ts", "lib/fetch/present.ts", "lib/fetch/scenarios.ts"]);
});
test("the app records the same contract (when its checkout is beside this one)", { skip: !existsSync(join(APP, "lib/fetch/contract.json")) && "app checkout not present" }, () => {
  assert.deepEqual(JSON.parse(readFileSync(join(APP, "lib/fetch/contract.json"), "utf8")).files, contract.files);
});
