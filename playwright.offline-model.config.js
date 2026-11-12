import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: ["offline-model.spec.js", "cloud-progress.spec.js", "release-persistence.spec.js"],
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5186",
    serviceWorkers: "block",
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npm run dev -- --port 5186",
    url: "http://127.0.0.1:5186",
    reuseExistingServer: false,
  },
});
