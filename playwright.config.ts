import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "visual",
  testMatch: "*.visual.ts",
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["stateofpixel/playwright", { buildName: "site" }]],
  use: {
    baseURL: "http://localhost:5173",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 800 },
      },
    },
  ],
  webServer: {
    command: "pnpm dev --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
