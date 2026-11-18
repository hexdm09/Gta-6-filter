import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.mjs",
  timeout: 30_000,
  workers: 2,
});
