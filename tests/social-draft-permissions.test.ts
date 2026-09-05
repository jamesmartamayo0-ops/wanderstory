import assert from "node:assert/strict";
import test from "node:test";
import { canAccess, rolesFor } from "../lib/permissions";

test("SUPER_ADMIN has every SocialDraft mutation permission", () => {
  for (const permission of [
    "social:create",
    "social:update",
    "social:ready",
    "social:delete",
  ] as const) {
    assert.equal(canAccess("SUPER_ADMIN", permission), true, permission);
  }
});

test("EDITOR can create, update, and ready SocialDrafts", () => {
  for (const permission of [
    "social:create",
    "social:update",
    "social:ready",
  ] as const) {
    assert.equal(canAccess("EDITOR", permission), true, permission);
  }
});

test("EDITOR cannot delete SocialDrafts", () => {
  assert.equal(canAccess("EDITOR", "social:delete"), false);
  assert.deepEqual(rolesFor("social:delete"), ["SUPER_ADMIN"]);
});
