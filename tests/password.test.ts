import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import test from "node:test";
import { generateToken, hashPassword, hashToken, verifyPassword } from "../lib/password.ts";

test("session tokens have independent entropy and store only stable SHA-256 digests", async () => {
  const tokens = Array.from({ length: 64 }, generateToken);
  assert.equal(new Set(tokens).size, 64);
  for (const token of tokens) assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(await hashToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.notEqual(await hashToken(tokens[0]), tokens[0]);
});

test("portable password hashes match independent PBKDF2 and preserve exact unicode/spacing", async () => {
  const password = "  campus café 🔐 2026  ";
  const first = await hashPassword(password), second = await hashPassword(password);
  assert.notEqual(first, second, "fresh salts prevent matching password hashes");
  const [, , rounds, salt, digest] = first.split(":");
  assert.equal(Number(rounds), 600_000);
  assert.equal(digest, pbkdf2Sync(password, Buffer.from(salt, "hex"), Number(rounds), 32, "sha256").toString("hex"));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(password.trim(), first), false);
  assert.equal(await verifyPassword("incorrect password", first), false);
});

test("password verification rejects malformed, downgraded and excessive hashes", async () => {
  const salt = "a".repeat(32), digest = "b".repeat(64);
  for (const stored of ["", "plaintext", `pbkdf2:sha256:1:${salt}:${digest}`, `pbkdf2:sha256:999999999:${salt}:${digest}`, `pbkdf2:sha1:600000:${salt}:${digest}`, `pbkdf2:sha256:600000:bad:${digest}`, `pbkdf2:sha256:600000:${salt}:${digest}extra`]) {
    assert.equal(await verifyPassword("Some password", stored), false);
  }
  assert.equal(await verifyPassword("x".repeat(257), `pbkdf2:sha256:600000:${salt}:${digest}`), false);
});
