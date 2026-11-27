import { defineConfig, devices } from "@playwright/test";

const GALLERY = "https://localhost:3000/playwright/gallery/index.html";

export default defineConfig({
  testDir: "./tests/components",
  testMatch: "**/*.spec.ts",
  timeout: 10_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: GALLERY,
    ignoreHTTPSErrors: true,
    serviceWorkers: "block",
    reuseContext: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: GALLERY,
    reuseExistingServer: true,
    ignoreHTTPSErrors: true,
  },
});
