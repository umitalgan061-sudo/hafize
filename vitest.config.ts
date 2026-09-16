import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'public/typed/**/*.test.ts'],
    passWithNoTests: true,
    reporters: process.env.CI ? ['github-actions', 'default'] : ['default'],
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 5000
  }
});
