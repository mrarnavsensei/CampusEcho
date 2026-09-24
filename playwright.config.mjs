import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";

const baseURL = process.env.TEST_BASE_URL || "http://localhost:5173";
const url = new URL(baseURL);
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/" || url.username || url.password || url.search || url.hash) throw new Error("Browser fixtures require a loopback TEST_BASE_URL.");
process.env.TEST_BASE_URL = url.origin;
process.env.TEST_DB_BACKEND = "sqlite";
process.env.ECHO_BROWSER_TEST_ADDRESS = `fd00:${randomBytes(2).toString("hex")}:${randomBytes(2).toString("hex")}::1`;

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    extraHTTPHeaders: { "cf-connecting-ip": process.env.ECHO_BROWSER_TEST_ADDRESS },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: { command: "node scripts/run-framework.mjs dev", url: `${url.origin}/api/health`, reuseExistingServer: !process.env.CI, timeout: 180_000 },
  projects: [
    { name: "api", testMatch: "http.spec.mjs" },
    ...[
      { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
      { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 800 } } },
      { name: "webkit", use: { ...devices["Desktop Safari"] } },
      { name: "mobile-chromium", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 } } },
      { name: "mobile-webkit", use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } },
    ].map(project => ({ ...project, testMatch: "launch.spec.mjs", dependencies: ["api"] })),
  ],
});
