import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const oauthPath = fileURLToPath(new URL('../lib/canva-oauth-runtime.mjs', import.meta.url));
const exchangePath = fileURLToPath(new URL('../lib/canva-token-exchange.mjs', import.meta.url));
const upstreamPath = fileURLToPath(new URL('../lib/canva-oauth-upstream.mjs', import.meta.url));
const flowPath = fileURLToPath(new URL('../lib/oauth-flow-runtime.mjs', import.meta.url));
const [oauthSource, exchangeSource, upstreamSource, flowSource] = await Promise.all([
  readFile(oauthPath, 'utf8'),
  readFile(exchangePath, 'utf8'),
  readFile(upstreamPath, 'utf8'),
  readFile(flowPath, 'utf8')
]);

for (const path of [oauthPath, exchangePath, upstreamPath]) {
  const checked = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr || checked.stdout || `${path} syntax failed`);
}

assert.match(oauthSource, /async function start\(input, \{ ownerId \} = \{\}\)/);
assert.match(oauthSource, /scopes: policy\.scopes,\s*ownerId/s);
assert.match(oauthSource, /expiresAt: Number\.isSafeInteger\(started\.expiresAt\)/);
assert.match(oauthSource, /if \(result\.provider !== 'canva'\) throw new Error\('CANVA_OAUTH_FLOW_PROVIDER_MISMATCH'\)/);
assert.match(flowSource, /store\.issue\(\{ state, verifier, provider, redirectUri, scopes, ownerId \}\)/);
assert.match(flowSource, /ownerId: flow\.ownerId/);

assert.match(exchangeSource, /const MAX_SCOPES = 32/);
assert.match(exchangeSource, /const SCOPE_PATTERN =/);
assert.match(exchangeSource, /function assertExpectedScopes\(/);
assert.match(exchangeSource, /CANVA_TOKEN_EXCHANGE_SCOPE_MISMATCH/);
assert.match(exchangeSource, /expectedScopes/);
assert.match(exchangeSource, /assertExpectedScopes\(tokens\.scopes, safeExpectedScopes\)/);
const assertionIndex = exchangeSource.indexOf('assertExpectedScopes(tokens.scopes, safeExpectedScopes)');
const saveIndex = exchangeSource.indexOf('await tokenStore.save');
assert.equal(assertionIndex > -1 && saveIndex > assertionIndex, true, 'scope integrity must be checked before token persistence');

for (const forbidden of [
  /console\.log\([^)]*(?:accessToken|refreshToken|clientSecret)/i,
  /process\.env\.[A-Z0-9_]*(?:TOKEN|SECRET|KEY)/,
  /localStorage|sessionStorage|document\.cookie/,
  /\bshell\s*=\s*true\b/i,
  /child_process|\bexec\s*\(|\bspawn\s*\(/,
  /\.github\/workflows/
]) {
  assert.equal(forbidden.test(oauthSource), false, `OAuth runtime forbidden surface: ${forbidden}`);
  assert.equal(forbidden.test(exchangeSource), false, `token exchange forbidden surface: ${forbidden}`);
}

assert.equal(upstreamSource.includes("redirect: 'error'"), true, 'token endpoint redirects must stay disabled');
assert.equal(upstreamSource.includes("'content-type': 'application/x-www-form-urlencoded'"), true);
assert.equal(exchangeSource.includes('Basic ${Buffer.from'), true, 'client secret remains server-side Basic auth input');
assert.equal(oauthSource.includes('clientSecret'), false, 'OAuth authorization URL builder must never receive client secret');
assert.equal(oauthSource.includes('accessToken'), false);
assert.equal(oauthSource.includes('refreshToken'), false);

console.log('Canva OAuth owner/scope source boundary tests passed');
