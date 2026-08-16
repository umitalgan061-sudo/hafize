import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, styleLoader, css, loader, policy, server] = await Promise.all([
  readFile(new URL('../public/github-write-readiness.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/github-write-readiness-style.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/github-write-readiness.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8'),
  readFile(new URL('../server.mjs', import.meta.url), 'utf8')
]);

assert.match(source, /HEALTH_PATH = '\/api\/health'/);
assert.match(source, /githubWriteConfigured/);
assert.match(source, /ayrı açık onay gerektirir/);
assert.match(source, /Merge, repo silme ve secret görüntüleme/);
assert.match(source, /method: 'GET'/);
assert.match(source, /cache: 'no-store'/);
assert.match(source, /credentials: 'same-origin'/);
assert.match(styleLoader, /github-write-readiness\.css/);
assert.match(css, /focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);
assert.match(loader, /HafizeGitHubWriteReadinessStyle/);
assert.match(loader, /HafizeGitHubWriteReadiness/);
assert.match(policy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v59`/);
assert.match(policy, /'\/github-write-readiness\.js'/);
assert.match(policy, /'\/github-write-readiness-style\.js'/);
assert.match(policy, /'\/github-write-readiness\.css'/);
assert.match(policy, /pathname\.startsWith\('\/api\/'\).*network-only/s);
assert.match(server, /githubWriteConfigured: GITHUB_WRITE_NODE_SERVER_RUNTIME\.configured/);

for (const forbidden of [
  /\/api\/github\/write\/prepare/,
  /\/api\/github\/write\/execute/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /document\.cookie/,
  /navigator\.clipboard/,
  /Authorization/,
  /Bearer /,
  /GITHUB_TOKEN/,
  /APPROVAL_SECRET/,
  /\.submit\s*\(/
]) {
  assert.doesNotMatch(source, forbidden);
}

console.log('github write readiness integration tests passed');
