import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "offline-ui.spec.js",
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:5185",
    serviceWorkers: "allow",
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "PORT=5185 node scripts/serve.mjs",
    url: "http://127.0.0.1:5185",
    reuseExistingServer: false,
  },
});
