import test from "node:test";
import assert from "node:assert/strict";
import * as c from "../lib/correction.ts";

test("raise: section must match the target and message be long enough", () => {
  assert.deepEqual(c.validateRaise({ section: "DOCUMENTS", message: "Passport unreadable", isVisa: false }), []);
  assert.deepEqual(c.validateRaise({ section: "VISA_OTHER", message: "Passport unreadable", isVisa: false }), ["SECTION_INVALID"]);
  assert.deepEqual(c.validateRaise({ section: "DOCUMENTS", message: "Passport unreadable", isVisa: true }), ["SECTION_INVALID"]);
  assert.deepEqual(c.validateRaise({ section: "OTHER", message: "no", isVisa: false }), ["MESSAGE_TOO_SHORT"]);
});
test("answer: text or file, only while open", () => {
  assert.deepEqual(c.validateAnswer({ status: "OUVERT" }, " ", []), ["ANSWER_EMPTY"]);
  assert.deepEqual(c.validateAnswer({ status: "OUVERT" }, "", [{ name: "a.pdf", url: "u" }]), []);
  assert.deepEqual(c.validateAnswer({ status: "OUVERT" }, "Done", []), []);
  assert.deepEqual(c.validateAnswer({ status: "REPONDU" }, "Done", []), ["NOT_OPEN"]);
});
test("close and unresolved", () => {
  assert.deepEqual(c.validateClose({ status: "CLOTURE" }), ["NOT_CLOSABLE"]);
  assert.deepEqual(c.validateClose({ status: "REPONDU" }), []);
  assert.equal(c.isUnresolved({ status: "REPONDU" }), true);
  assert.equal(c.isUnresolved({ status: "CLOTURE" }), false);
});
test("waiver: explanation mandatory, only while pending, stops blocking", () => {
  assert.equal(c.isBlocking({ status: "OUVERT", is_blocking: true }), true);
  assert.equal(c.isBlocking({ status: "OUVERT", is_blocking: false }), false);
  assert.equal(c.isBlocking({ status: "CLOTURE", is_blocking: true }), false);
  assert.deepEqual(c.validateWaiver({ status: "OUVERT", is_blocking: true }, "too short"), ["WAIVER_REASON_TOO_SHORT"]);
  assert.deepEqual(c.validateWaiver({ status: "OUVERT", is_blocking: true }, "Provided with the renewal"), []);
  assert.deepEqual(c.validateWaiver({ status: "CLOTURE", is_blocking: true }, "Provided with the renewal"), ["NOT_WAIVABLE"]);
  assert.deepEqual(c.validateWaiver({ status: "OUVERT", is_blocking: false }, "Provided with the renewal"), ["NOT_WAIVABLE"]);
  assert.deepEqual(c.validateRaise({ section: "OTHER", message: "A remark on file", isVisa: false, nonBlockingReason: "x" }), ["WAIVER_REASON_TOO_SHORT"]);
  assert.deepEqual(c.validateRaise({ section: "OTHER", message: "A remark on file", isVisa: false, nonBlockingReason: "Not needed right now" }), []);
});
