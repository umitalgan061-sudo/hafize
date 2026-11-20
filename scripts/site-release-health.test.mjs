import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditLocalBuild, probeLiveSite, referencedAssets } from './site-release-health.mjs';

const page = '<!doctype html><html><head><title>Hafize</title><link rel="stylesheet" href="/styles.css?v=11"><script src="/typed-build/app-shell.js"></script></head><body><textarea id="composer"></textarea></body></html>';

function fakeFetch({ home = page, wrongAsset = '', apiOk = true } = {}) {
  return async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === '/') return new Response(home, { status: 200, headers: { 'content-type': 'text/html' } });
    if (path === '/api/health') return apiOk
      ? new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } })
      : new Response('<html>not an API</html>', { status: 200, headers: { 'content-type': 'text/html' } });
    if (path === wrongAsset) return new Response('<html>index fallback</html>', { status: 200, headers: { 'content-type': 'text/html' } });
    if (path.endsWith('.css')) return new Response('body{color:black}', { status: 200, headers: { 'content-type': 'text/css' } });
    if (path.endsWith('.js')) return new Response('export {}', { status: 200, headers: { 'content-type': 'application/javascript' } });
    if (path.endsWith('.webmanifest')) return new Response('{}', { status: 200, headers: { 'content-type': 'application/manifest+json' } });
    return new Response('not found', { status: 404 });
  };
}

describe('Firebase Hosting recovery diagnostics', () => {
  it('extracts only local assets and strips query strings', () => {
    const html = '<script src="/typed-build/app-shell.js?v=4"></script><link href="/styles.css?x=1" rel="stylesheet"><img src="//evil.example/x.png"><script src="https://other.example/x.js"></script>';
    assert.deepEqual(referencedAssets(html), ['/typed-build/app-shell.js', '/styles.css']);
  });

  it('detects missing build outputs even if source HTML exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'hafize-release-'));
    try {
      mkdirSync(join(root, 'public'), { recursive: true });
      writeFileSync(join(root, 'public', 'index.html'), page);
      const report = auditLocalBuild(root);
      assert.equal(report.ok, false);
      assert.ok(report.problems.includes('ASSET_MISSING:/typed-build/app-shell.js'));
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('rejects Firebase setup or missing entrypoint pages', async () => {
    const result = await probeLiveSite({ fetchImpl: fakeFetch({ home: '<title>Site Not Found</title>' }) });
    assert.equal(result.state, 'broken');
    assert.equal(result.site.reason, 'UNEXPECTED_HTML');
  });

  it('checks frontend assets and JSON API independently', async () => {
    const result = await probeLiveSite({ fetchImpl: fakeFetch() });
    assert.equal(result.state, 'healthy');
    assert.equal(result.api.state, 'healthy');
    assert.equal(result.failedAssets.length, 0);
    assert.ok(result.assetCount > 4);
  });

  it('detects SPA HTML fallbacks served as JavaScript modules', async () => {
    const result = await probeLiveSite({ fetchImpl: fakeFetch({ wrongAsset: '/typed-build/app-shell.js' }) });
    assert.equal(result.state, 'broken');
    assert.ok(result.failedAssets.some((x) => x.path === '/typed-build/app-shell.js' && x.reason === 'WRONG_CONTENT_TYPE'));
  });

  it('reports a working frontend with a missing backend as degraded', async () => {
    const result = await probeLiveSite({ fetchImpl: fakeFetch({ apiOk: false }) });
    assert.equal(result.state, 'degraded');
    assert.equal(result.api.reason, 'NOT_JSON_HEALTH');
  });

  it('rejects unsupported URLs and invalid timeouts', async () => {
    await assert.rejects(() => probeLiveSite({ site: 'http://127.0.0.1/', fetchImpl: fakeFetch() }), /INVALID_SITE_URL/);
    await assert.rejects(() => probeLiveSite({ site: 'https://evil.example/', fetchImpl: fakeFetch() }), /INVALID_SITE_URL/);
    await assert.rejects(() => probeLiveSite({ timeoutMs: 0, fetchImpl: fakeFetch() }), /INVALID_TIMEOUT/);
  });
});
