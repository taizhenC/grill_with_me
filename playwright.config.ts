import { defineConfig } from "@playwright/test";

// Test the compiled application with explicit fixture storage. No deployment
// credentials or existing local server are used or reused.
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 30_000,
  globalTimeout: 180_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3108", browserName: "chromium" },
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3108",
    url: "http://127.0.0.1:3108",
    timeout: 30_000,
    reuseExistingServer: false,
    env: {
      NODE_ENV: "test", GRILL_STORE: "memory", SUPABASE_URL: "",
      SUPABASE_SERVICE_KEY: "", VERCEL: "", GRILL_TRUST_PROXY: "",
      GRILL_PUBLIC_ORIGIN: "", CRON_SECRET: "",
    },
  },
});
