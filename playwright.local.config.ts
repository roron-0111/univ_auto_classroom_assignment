import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: {
    timeout: 15_000
  },
  reporter: [['list']]
});
