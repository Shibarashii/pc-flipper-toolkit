import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: CI,
  // One retry in CI, so a flaky run shows up as "flaky" in the report instead of red.
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  // The real stack: Django (on whatever DATABASE_URL says) behind Vite's /api proxy.
  webServer: [
    {
      command:
        ".venv/bin/python manage.py migrate --no-input && .venv/bin/python manage.py runserver 8000 --noreload",
      cwd: "../backend",
      url: "http://localhost:8000/api/schema/",
      reuseExistingServer: !CI,
    },
    {
      command: "npm run dev -- --port 5173 --strictPort",
      url: "http://localhost:5173",
      reuseExistingServer: !CI,
    },
  ],
});
