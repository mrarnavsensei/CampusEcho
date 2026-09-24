import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash, randomUUID, randomBytes, pbkdf2Sync } from "node:crypto";
import { createFixture, cleanupFixture, base, db, sqlValue } from "../../scripts/integration-helpers.mjs";

const adminLoginEmail = `browser-${randomUUID()}@example.invalid`;
const testAddress = process.env.ECHO_BROWSER_TEST_ADDRESS;
if (!testAddress) throw new Error("Browser QA requires an isolated test address.");
const digest = value => createHash("sha256").update(value).digest("hex");

test.afterAll(() => {
  db(`DELETE FROM security_rate_limits WHERE key IN (${sqlValue(digest(`admin-login:${testAddress}`))},${sqlValue(digest(`admin-login-email:${adminLoginEmail}`))})`);
});

async function runtimeErrors(page) {
  const errors = [];
  await page.exposeFunction("__echoQaRuntimeError", message => errors.push(message));
  await page.addInitScript(() => {
    // WebKit also reports cancelled fetch diagnostics through Playwright pageerror.
    // Observe actual window errors/rejections and policy violations instead.
    window.addEventListener("error", event => { if (event.message) void window.__echoQaRuntimeError(event.message); });
    window.addEventListener("unhandledrejection", event => { void window.__echoQaRuntimeError(String(event.reason)); });
    window.addEventListener("securitypolicyviolation", event => { void window.__echoQaRuntimeError(`CSP: ${event.violatedDirective}`); });
  });
  return errors;
}

async function accessible(page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test("student login hydrates, recovery navigation works, and public pages are accessible", async ({ page, context }) => {
  const errors = await runtimeErrors(page);
  // Explicit invalid session prevents the optional local identity from masking login.
  await context.addCookies([{ name: "echo_session", value: "0".repeat(64), url: base }]);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome to Echo" })).toBeVisible();
  const authPolicies = page.getByRole("navigation", { name: "Authentication legal and privacy links" });
  await expect(authPolicies.getByRole("link", { name: "Privacy", exact: true })).toHaveAttribute("href", "/community#privacy");
  await expect(authPolicies.getByRole("link", { name: "Support", exact: true })).toHaveAttribute("href", "/community#support");
  await page.getByLabel("College email").fill("browser@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("temporary-password");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await accessible(page);
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await accessible(page);
  await page.goto("/community");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const id of ["privacy", "terms", "community-guidelines", "retention", "support", "appeals"]) await expect(page.locator(`#${id}`)).toHaveCount(1);
  await accessible(page);
  expect(errors).toEqual([]);
});

test("administrator protection, login hydration and error feedback", async ({ page }) => {
  const errors = await runtimeErrors(page);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Email Address").fill(adminLoginEmail);
  await page.getByLabel("Password", { exact: true }).fill("incorrect-browser-password");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Sign in to Admin" }).click();
  await expect(page.getByRole("alert")).toContainText(/invalid|too many/i);
  await accessible(page);
  expect(errors).toEqual([]);
});

test("student posts persist and dialogs, navigation, profile and logout work", async ({ page, context }) => {
  const fixture = createFixture("qa_browser");
  const password = `Browser-${randomUUID()}`, salt = randomBytes(16);
  const hash = `pbkdf2:sha256:600000:${salt.toString("hex")}:${pbkdf2Sync(password, salt, 600000, 32, "sha256").toString("hex")}`;
  const errors = await runtimeErrors(page);
  try {
    db(`INSERT INTO user_credentials(user_id,password_hash,updated_at) VALUES(${sqlValue(fixture.students[0].id)},${sqlValue(hash)},${Date.now()})`);
    await context.addCookies([{ name: "echo_session", value: "0".repeat(64), url: base }]);
    await page.goto("/");
    await page.getByLabel("College email").fill(fixture.students[0].email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Campus pulse" })).toBeVisible();
    await accessible(page);
    const open = page.getByRole("button", { name: "Create post", exact: true });
    // Safari does not focus buttons on pointer clicks. Exercise keyboard focus return.
    await open.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Share an echo" });
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel("Your post")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(open).toBeFocused();
    await open.click();
    const body = `Browser persistence check ${randomUUID()}`;
    await page.getByLabel("Your post").fill(body);
    await accessible(page);
    await page.getByRole("button", { name: "Post anonymously", exact: true }).click();
    await expect(page.getByText(body, { exact: true })).toBeVisible();
    // Let the refresh triggered by publishing finish before navigation. Cancelling an
    // active Worker proxy request during WebKit reload can surface as a false 500.
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByText(body, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Like post", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unlike post", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Save post", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unsave post", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Post options", exact: true }).first().click();
    await page.getByRole("button", { name: "Report post", exact: true }).first().click();
    const reportPolicies = page.getByRole("navigation", { name: "Report policy links" });
    await expect(reportPolicies.getByRole("link", { name: "Community guidelines", exact: true })).toBeVisible();
    await expect(reportPolicies.getByRole("link", { name: "Appeals", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close dialog", exact: true }).click();
    const nav = page.getByRole("navigation", { name: "Main navigation", exact: true });
    const mobile = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
    const navigation = await nav.isVisible() ? nav : mobile;
    await navigation.getByRole("button", { name: "Messages", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your inbox" })).toBeVisible();
    await accessible(page);
    await navigation.getByRole("button", { name: "Profile", exact: true }).click();
    await page.getByRole("button", { name: "Edit profile", exact: true }).click();
    await page.getByLabel("Display name", { exact: true }).fill("Browser verified student");
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Browser verified student", exact: true })).toBeVisible();
    const accountPolicies = page.getByRole("navigation", { name: "Account legal and privacy links" });
    await expect(accountPolicies.getByRole("link", { name: "Retention and deletion", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Request account deletion", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Deletion policy links" })).toBeVisible();
    await page.getByRole("button", { name: "Close dialog", exact: true }).click();
    await accessible(page);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Welcome to Echo" })).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: test.info().outputPath("signed-out.png"), fullPage: true });
  } finally {
    await context.clearCookies(); await page.goto("about:blank");
    db(`DELETE FROM user_credentials WHERE user_id=${sqlValue(fixture.students[0].id)}`);
    cleanupFixture(fixture);
  }
});
