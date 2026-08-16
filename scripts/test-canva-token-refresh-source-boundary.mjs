import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../lib/canva-token-refresh.mjs', import.meta.url));
const source = await readFile(path, 'utf8');
const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || 'Canva refresh syntax failed');

assert.match(source, /const MAX_SCOPES = 32/);
assert.match(source, /const SCOPE_PATTERN =/);
assert.match(source, /function assertSameScopes\(/);
assert.match(source, /CANVA_TOKEN_REFRESH_SCOPE_MISMATCH/);
assert.match(source, /normalizeScopes\(current\.scopes, 'previousScopes'\)/);
assert.match(source, /assertSameScopes\(text\(value\.scope/);
assert.match(source, /redirect: 'error'/);

const networkIndex = source.indexOf('const response = await fetchImpl');
const previousScopeIndex = source.indexOf("const previousScopes = normalizeScopes(current.scopes, 'previousScopes')");
const saveIndex = source.indexOf('await tokenStore.save');
const normalizeResponseIndex = source.indexOf('const tokens = normalizeResponse');
assert.equal(previousScopeIndex > -1 && networkIndex > previousScopeIndex, true, 'stored scope validation must happen before refresh network call');
assert.equal(normalizeResponseIndex > networkIndex && saveIndex > normalizeResponseIndex, true, 'provider scope response must be validated before save');

for (const forbidden of [
  /console\.log\([^)]*(?:accessToken|refreshToken|clientSecret)/i,
  /localStorage|sessionStorage|document\.cookie/,
  /\bshell\s*=\s*true\b/i,
  /child_process|\bexec\s*\(|\bspawn\s*\(/,
  /\.github\/workflows/
]) {
  assert.equal(forbidden.test(source), false, `refresh runtime forbidden surface: ${forbidden}`);
}

assert.equal(source.includes("'content-type': 'application/x-www-form-urlencoded'"), true);
assert.equal(source.includes('Basic ${Buffer.from'), true);
assert.equal(source.includes('provider: \'canva\''), true);
assert.equal(source.includes('ownerId: owner'), true);

console.log('Canva token refresh source boundary tests passed');
