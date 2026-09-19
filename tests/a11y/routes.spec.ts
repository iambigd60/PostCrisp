import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * WCAG 2.1 AA scan of representative routes. Fails on any serious or
 * critical axe violation — colour contrast, missing accessible names,
 * unlabelled form controls, invalid ARIA.
 *
 * The public routes exercise the design tokens, focus styles, form labels and
 * the skip link. The dashboard routes cover the sidebar, the credit ring, the
 * caption pickers and a tool page; they need a real account and are skipped
 * when E2E_EMAIL / E2E_PASSWORD are not set.
 */

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password"];
const DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard/generate",
  "/dashboard/create",
  "/dashboard/foundation-analysis",
  "/dashboard/settings",
];

async function expectNoSeriousViolations(page: Page, route: string) {
  // @axe-core/playwright pins its own playwright-core, whose Page type lags
  // @playwright/test by a few methods; the runtime object is the same.
  const results = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const report = serious
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n  ")}`)
    .join("\n\n");
  expect(serious, `${route}\n${report}`).toEqual([]);
}

for (const route of PUBLIC_ROUTES) {
  test(`public ${route} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(route, { waitUntil: "networkidle" });
    await expectNoSeriousViolations(page, route);
  });
}

test("skip link is the first focusable element", async ({ page }) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toHaveText(/skip to content/i);
});

test.describe("dashboard (needs E2E_EMAIL / E2E_PASSWORD)", () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, "No test account configured");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  for (const route of DASHBOARD_ROUTES) {
    test(`${route} has no serious accessibility violations`, async ({ page }) => {
      await page.goto(route, { waitUntil: "networkidle" });
      await expectNoSeriousViolations(page, route);
    });
  }

  test("sidebar marks the current page", async ({ page }) => {
    await page.goto("/dashboard/generate");
    await expect(page.locator('nav[aria-label="Main"] a[aria-current="page"]')).toHaveText(/captions/i);
  });
});
