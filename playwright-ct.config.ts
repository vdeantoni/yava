import { defineConfig, devices } from "@playwright/experimental-ct-react";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.tsx",
  timeout: 10_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    trace: "on-first-retry",
    ctViteConfig: {
      plugins: [react()],
      resolve: {
        alias: {
          "@": resolve(import.meta.dirname, "src"),
          "@ffmpeg/ffmpeg": resolve(
            import.meta.dirname,
            "src/__mocks__/@ffmpeg/ffmpeg.ts",
          ),
        },
      },
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
