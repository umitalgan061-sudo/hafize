import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
function source(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('GitHub App CI panel integration contract', () => {
  it('is included in both Vite dev and production entrypoints', () => {
    const vite = source('vite.config.ts');
    const html = source('public/index.html');
    expect(vite).toContain("'github-app-ci-panel': resolve(ROOT, 'public/github-app-ci-panel.ts')");
    expect(vite).toContain(".replaceAll('/typed-build/github-app-ci-panel.js', '/github-app-ci-panel.ts')");
    expect(html).toContain('src="/typed-build/github-app-ci-panel.js"');
    expect(html.indexOf('src="/typed-build/github-workspace.js"')).toBeLessThan(
      html.indexOf('src="/typed-build/github-app-ci-panel.js"')
    );
  });

  it('keeps the CI endpoint behind the existing session gate', () => {
    const guard = source('lib/production-guard.ts');
    const server = source('server.ts');
    expect(guard).toContain("'/api/github/app/ci'");
    expect(server).toContain('if (!req.__hafizePrincipal)');
    expect(server).toContain("url.pathname === '/api/github/app/ci'");
    expect(server).toContain('await handleGitHubAppCi(req, url, res)');
  });

  it('renders untrusted GitHub content as text without exposing credentials', () => {
    const client = source('public/github-app-ci-panel.ts');
    expect(client).not.toMatch(/\.innerHTML\s*=/);
    expect(client).not.toMatch(/\.outerHTML\s*=/);
    expect(client).toContain('element.textContent = value');
    expect(client).toContain("credentials: 'same-origin'");
    expect(client).toContain("cache: 'no-store'");
    expect(client).toContain("refresh.addEventListener('click', () => void load())");
    expect(client).not.toMatch(/localStorage\.|sessionStorage\./);
  });

  it('uses separate request ordering for CI detail controls', () => {
    const client = source('public/github-app-ci-panel.ts');
    expect(client).toContain('const detailRequests = new WeakMap<HTMLElement, number>()');
    expect(client).toContain('detailRequests.get(holder) !== requestId');
    expect(client).toContain('const current = ++generation');
  });
});
