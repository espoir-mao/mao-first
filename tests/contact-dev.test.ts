import test from "node:test";
import assert from "node:assert/strict";
import { validateContact } from "../lib/contact.ts";
import { validateDevRequest, validateDevStatusChange } from "../lib/dev-request.ts";

const ok = { first_name: "Jane", last_name: "Visitor", email: "jane@example.com", phone: "+971 50 123 4567", company: "", subject: "Question", message: "I would like to know more" };

test("contact: a visitor must identify themselves", () => {
  assert.deepEqual(validateContact(ok), []);
  assert.deepEqual(validateContact({ ...ok, first_name: "J", last_name: " " }), ["FIRST_NAME_REQUIRED", "LAST_NAME_REQUIRED"]);
  assert.deepEqual(validateContact({ ...ok, email: "jane@" }), ["EMAIL_INVALID"]);
  assert.deepEqual(validateContact({ ...ok, phone: "call me" }), ["PHONE_INVALID"]);
  assert.deepEqual(validateContact({ ...ok, phone: "" }), []); // phone optional
  assert.deepEqual(validateContact({ ...ok, subject: "ab", message: "short" }), ["SUBJECT_TOO_SHORT", "MESSAGE_TOO_SHORT"]);
});

test("dev request: fields and declined needs a comment", () => {
  const good = { kind: "FEATURE", priority: "NORMAL", title: "Export CSV", description: "Add a CSV export of the list" };
  assert.deepEqual(validateDevRequest(good), []);
  assert.deepEqual(validateDevRequest({ ...good, kind: "WISH", priority: "URGENT", title: "x", description: "short" }),
    ["KIND_INVALID", "PRIORITY_INVALID", "TITLE_TOO_SHORT", "DESCRIPTION_TOO_SHORT"]);
  assert.deepEqual(validateDevStatusChange("DONE", ""), []);
  assert.deepEqual(validateDevStatusChange("DECLINED", " "), ["COMMENT_REQUIRED"]);
  assert.deepEqual(validateDevStatusChange("DECLINED", "Out of scope"), []);
  assert.deepEqual(validateDevStatusChange("MAYBE", "x"), ["STATUS_INVALID"]);
});
