import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'public/typed/**/*.test.ts', 'lib/**/*.test.ts'],
    passWithNoTests: false,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10_000,
    reporters: process.env.CI ? ['github-actions', 'default'] : ['default']
  }
});
