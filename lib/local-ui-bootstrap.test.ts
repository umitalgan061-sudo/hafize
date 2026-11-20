import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const html = readFileSync(resolve(root, 'public/index.html'), 'utf8');
const vite = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');

describe('local Hafize UI bootstrap', () => {
  it('builds browser modules before starting the standalone Node backend', () => {
    expect(pkg.scripts['predev:server']).toBe('npm run build');
    expect(pkg.scripts.dev).toContain('vite ');
    expect(pkg.scripts['dev:server']).toContain('server.ts');
    expect(pkg.scripts.prestart).toBe('npm run build');
  });

  it('serves the sidebar controller and GitHub write interface from generated UI bundles', () => {
    expect(html).toContain('/typed-build/ui-shell.js');
    expect(html).toContain('/typed-build/github-workspace-write.js');
    expect(vite).toContain("'ui-shell': resolve(ROOT, 'public/typed/ui-shell.ts')");
    expect(vite).toContain("'github-workspace-write': resolve(ROOT, 'public/github-workspace-write.ts')");
    expect(vite).toContain("outDir: resolve(ROOT, 'public/typed-build')");
  });
});
