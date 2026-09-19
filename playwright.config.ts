import { defineConfig, devices } from "@playwright/test";

/**
 * Accessibility smoke suite (interface audit: "add @axe-core/playwright
 * against representative routes before Wave 1 lands, or the same debt
 * rebuilds"). Runs against a production build so what is tested is what ships.
 *
 * Public routes always run. Dashboard routes need a signed-in session, so
 * they run only when E2E_EMAIL and E2E_PASSWORD are set (see tests/a11y).
 */
const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./tests/a11y",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    colorScheme: "dark",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
