import test from "node:test";
import assert from "node:assert/strict";
import { buildProfileRequest, effectiveProfile } from "../lib/profile-request.ts";

const cur = { first_name: "Amina", last_name: "Traoré", email: "a@x.com" };

test("keeps only changed fields, trimmed", () => {
  const r = buildProfileRequest(cur, { first_name: " Amina ", last_name: "Diallo", holder_status: "MANAGER" });
  assert.deepEqual(r.values, { last_name: "Diallo", holder_status: "MANAGER" });
  assert.deepEqual(r.issues, []);
});
test("no change is refused", () => {
  assert.deepEqual(buildProfileRequest(cur, { ...cur }).issues, ["NO_CHANGE"]);
});
test("rejects blank name, bad email, bad status", () => {
  assert.deepEqual(buildProfileRequest(cur, { first_name: "  " }).issues, ["NAME_REQUIRED"]);
  assert.deepEqual(buildProfileRequest(cur, { email: "nope" }).issues, ["EMAIL_INVALID"]);
  assert.deepEqual(buildProfileRequest(cur, { holder_status: "BOSS" as never }).issues, ["STATUS_INVALID"]);
});
test("approved requests overlay the base, refused/open ignored", () => {
  const p = effectiveProfile(cur, [
    { status: "approuve", created_at: "2026-01-02", requested_values: { last_name: "B" } },
    { status: "approuve", created_at: "2026-01-01", requested_values: { last_name: "A", holder_status: "MANAGER" } },
    { status: "refuse", created_at: "2026-01-03", requested_values: { last_name: "Z" } },
    { status: "ouvert", created_at: "2026-01-04", requested_values: { email: "n@x.com" } },
  ]);
  assert.deepEqual(p, { ...cur, last_name: "B", holder_status: "MANAGER" });
});
