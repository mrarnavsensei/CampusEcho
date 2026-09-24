import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";

test("real local HTTP security and authentication/social/admin/chess suites", () => {
  test.setTimeout(600_000);
  for (const name of ["http-smoke", "auth-integration", "social-integration", "admin-integration", "chess-integration"]) {
    const result = spawnSync(process.execPath, [`scripts/test-${name}.mjs`], { encoding: "utf8", env: process.env, timeout: 110_000, maxBuffer: 4 * 1024 * 1024 });
    console.log(result.stdout);
    expect(result.status, `${name}: ${result.error?.message || result.stderr}`).toBe(0);
  }
});
