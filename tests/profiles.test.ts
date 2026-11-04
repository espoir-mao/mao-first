import test from "node:test";
import assert from "node:assert/strict";
import * as p from "../lib/profiles.ts";

test("allowed profiles: plain account is société only", () => {
  assert.deepEqual(p.allowedProfiles({ email: "someone@example.com" }), ["SOCIETE"]);
  assert.deepEqual(p.allowedProfiles({}), ["SOCIETE"]);
});
test("allowed profiles: demo account switches between both", () => {
  assert.deepEqual(p.allowedProfiles({ email: "EspoirBatawila@conanjeken.com " }), ["SOCIETE", "BACKOFFICE"]);
  assert.deepEqual(p.allowedProfiles({ email: "x@y.z", extraDemoEmails: "a@b.c, x@y.z" }), ["SOCIETE", "BACKOFFICE"]);
});
test("allowed profiles: app_metadata wins; a backoffice user also has the société area", () => {
  assert.deepEqual(p.allowedProfiles({ email: "espoirbatawila@conanjeken.com", appMetadataProfiles: ["SOCIETE"] }), ["SOCIETE"]);
  assert.deepEqual(p.allowedProfiles({ email: "a@b.c", appMetadataProfiles: ["BACKOFFICE"] }), ["SOCIETE", "BACKOFFICE"]);
  assert.deepEqual(p.allowedProfiles({ email: "a@b.c", appMetadataProfiles: ["nope", 3] }), ["SOCIETE"]);
  assert.deepEqual(p.allowedProfiles({ unauthenticatedDemo: true }), ["SOCIETE", "BACKOFFICE"]);
});
test("active profile: stored one only while allowed", () => {
  assert.equal(p.resolveActiveProfile(["SOCIETE", "BACKOFFICE"], "BACKOFFICE"), "BACKOFFICE");
  assert.equal(p.resolveActiveProfile(["SOCIETE"], "BACKOFFICE"), "SOCIETE");
  assert.equal(p.resolveActiveProfile(["SOCIETE", "BACKOFFICE"], null), "SOCIETE");
});
test("access: société profile stays out of backoffice and support", () => {
  for (const path of ["/", "/a-propos", "/licence", "/administration/demandes", "/administration/visas/nouvelle", "/societes/nouvelle", "/contact", "/profil"]) {
    assert.equal(p.canAccess("SOCIETE", path), true, path);
  }
  for (const path of ["/backoffice", "/backoffice/societes", "/backoffice/visas/abc", "/support"]) {
    assert.equal(p.canAccess("SOCIETE", path), false, path);
    assert.equal(p.canAccess("BACKOFFICE", path), true, path);
  }
  assert.equal(p.canAccess("SOCIETE", "/backofficeX"), true);
  assert.equal(p.landingFor("BACKOFFICE"), "/backoffice/societes");
});
