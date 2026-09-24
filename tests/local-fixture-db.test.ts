import assert from "node:assert/strict";
import test from "node:test";
import { executeLocalFixtureSql } from "../scripts/local-fixture-db.mjs";

test("low-memory fixture adapter refuses remote or ambiguous targets before opening a database", () => {
  const original = process.env.TEST_BASE_URL;
  try {
    for (const target of [
      "https://example.com", "http://localhost.example.com", "ftp://localhost",
      "http://user:secret@localhost", "http://localhost/api", "http://localhost/?remote=1",
      "http://localhost/#fragment",
    ]) {
      process.env.TEST_BASE_URL = target;
      assert.throws(() => executeLocalFixtureSql("SELECT 1"), /restricted to a loopback test server/);
    }
  } finally {
    if (original === undefined) delete process.env.TEST_BASE_URL;
    else process.env.TEST_BASE_URL = original;
  }
});
