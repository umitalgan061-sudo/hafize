import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../lib/cloud-session-auth.mjs', import.meta.url), 'utf8');

function section(startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0 && end > start, `missing source section ${startNeedle}`);
  return source.slice(start, end);
}

const passwordSection = section('function passwordBytes', 'function eraseBuffer');
const eraseSection = section('function eraseBuffer', 'function equalBytes');
const equalSection = section('function equalBytes', 'function sign');
const loginSection = section('async function login', 'function authenticate');

// Password bytes rejected after materialization must be cleared before the error escapes.
assert.match(passwordSection, /bytes\.fill\(0\);\s*fail\('CLOUD_SESSION_LOGIN_REJECTED'\)/s);

// Erasure helper is intentionally narrow: only mutable byte arrays are accepted.
assert.match(eraseSection, /Buffer\.isBuffer\(value\) \|\| value instanceof Uint8Array/);
assert.match(eraseSection, /value\.fill\(0\)/);
assert.doesNotMatch(eraseSection, /String\(|JSON\.stringify|console\./);

// timingSafeEqual's length-normalization scratch buffer must not survive the comparison.
assert.match(equalSection, /const padded = Buffer\.alloc\(right\.length\)/);
assert.match(equalSection, /finally\s*\{\s*eraseBuffer\(padded\);\s*\}/s);
assert.match(equalSection, /timingSafeEqual\(padded, right\)/);
assert.match(equalSection, /timingSafeEqual\(left, right\)/);

// Login converts scrypt output to a mutable Buffer and erases both password bytes and
// derived digest in a finally block that runs on match, mismatch, and crypto failure.
assert.match(loginSection, /let derived = null/);
assert.match(loginSection, /derived = Buffer\.from\(await scrypt\(/);
assert.match(loginSection, /passwordMatches = equalBytes\(derived, passwordConfig\.digest\)/);
assert.match(loginSection, /finally\s*\{\s*eraseBuffer\(supplied\);\s*eraseBuffer\(derived\);\s*\}/s);

const finallyIndex = loginSection.indexOf('finally');
const mismatchIndex = loginSection.indexOf('if (!passwordMatches)');
const issuedAtIndex = loginSection.indexOf('const issuedAt');
assert.ok(finallyIndex >= 0 && mismatchIndex > finallyIndex && issuedAtIndex > mismatchIndex);

// Secret bytes must not be logged, serialized into session payloads, or copied into errors.
assert.doesNotMatch(loginSection, /console\.(log|debug|info|warn|error)/);
assert.doesNotMatch(loginSection, /JSON\.stringify\([^\n]*(supplied|derived|password)/);
assert.doesNotMatch(loginSection, /error\.(detail|cause)\s*=\s*(supplied|derived|password)/);

console.log('cloud session secret buffer lifecycle contract: ok');
