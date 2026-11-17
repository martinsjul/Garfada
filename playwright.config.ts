import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Em ambientes com Chromium pré-instalado (ex.: CI/containers), aponte via PW_CHROMIUM_PATH.
const executablePath = process.env.PW_CHROMIUM_PATH;
const launchOptions = executablePath && existsSync(executablePath) ? { executablePath } : {};

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3100", launchOptions },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    env: { GEMINI_API_KEY: "fake" },
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], deviceScaleFactor: 2 } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
});
