import assert from "node:assert/strict";
import test from "node:test";
import { calculateElo, campusAlias, moderateWithRules, normalizedEmailDomain, parsePage } from "../lib/product-core.ts";

test("college email domains normalize safely", () => {
  assert.equal(normalizedEmailDomain(" Student@College.EDU "), "college.edu");
  assert.equal(normalizedEmailDomain("not-an-email"), null);
});

test("anonymous aliases are stable within a week and campus scoped", () => {
  const date = new Date("2026-09-20T00:00:00Z");
  assert.equal(campusAlias("u1", "c1", date), campusAlias("u1", "c1", date));
  assert.notEqual(campusAlias("u1", "c1", date), campusAlias("u1", "c2", date));
});

test("moderation rejects threats and personal information", () => {
  assert.equal(moderateWithRules("I will attack you").allowed, false);
  assert.equal(moderateWithRules("email me at private@example.com").status, "rejected");
  assert.equal(moderateWithRules("Chess club meets at six").status, "approved");
});

test("Elo updates are symmetric", () => {
  const result = calculateElo(1200, 1200, 1);
  assert.deepEqual(result, { ratingA: 1216, ratingB: 1184 });
});

test("pagination is bounded and rejects malformed cursors", () => {
  assert.deepEqual(parsePage(new URLSearchParams("limit=500&cursor=abc")), { limit: 50, cursor: null });
  assert.deepEqual(parsePage(new URLSearchParams("limit=10&cursor=123")), { limit: 10, cursor: 123 });
});
