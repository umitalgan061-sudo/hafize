import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-draft-pr-create.js');
const source = await readFile(new URL('../public/github-draft-pr-create.js', import.meta.url), 'utf8');
const contract = await readFile(new URL('../lib/github-write-contract.mjs', import.meta.url), 'utf8');

assert.equal(api.buildCommand({ headSuffix: 'x', baseRef: 'main', title: 'test' })?.draft, true);
assert.equal(source.includes("operation: 'pr.create'"), true);
assert.equal(source.includes("draft: true"), true);
assert.equal(source.includes("const REPOSITORY = 'umitalgan061-sudo/hafize'"), true);
assert.equal(source.includes("const BRANCH_PREFIX = 'hafize/'"), true);
assert.equal(source.includes("credentials: 'same-origin'"), true);
assert.equal(source.includes("cache: 'no-store'"), true);
assert.equal(source.includes("'/api/github/write/prepare'"), true);
assert.equal(source.includes("'/api/github/write/execute'"), true);
assert.equal(source.includes("approvalToken: snapshot.approvalToken"), true);
assert.equal(source.includes("new rootRef.CustomEvent('hafize:github-draft-pr-created'"), true);

for (const forbidden of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /document\.cookie/,
  /navigator\.clipboard/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon/,
  /innerHTML/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /shell\s*:\s*true/,
  /GITHUB_TOKEN/,
  /HAFIZE_GITHUB_WRITE_AUTH_TOKEN/,
  /HAFIZE_GITHUB_WRITE_APPROVAL_SECRET/,
  /HAFIZE_GITHUB_WRITE_OWNER_KEY/,
  /Authorization\s*:/
]) {
  assert.equal(forbidden.test(source), false, `forbidden draft PR UI surface: ${forbidden}`);
}

assert.match(contract, /GITHUB_WRITE_PR_MUST_BE_DRAFT/);
assert.match(contract, /normalizeAgentBranch\(input\.head/);
assert.match(contract, /title\.length > 180/);
assert.match(contract, /head === base/);
assert.match(contract, /Object\.freeze\(\{ operation, repository, head, base, title, draft: true \}\)/);

const badCommands = [
  { headSuffix: '../x', baseRef: 'main', title: 'x' },
  { headSuffix: 'x', baseRef: '../main', title: 'x' },
  { headSuffix: 'x', baseRef: 'main', title: '\u0000' },
  { headSuffix: 'x'.repeat(91), baseRef: 'main', title: 'x' },
  { headSuffix: 'x', baseRef: 'main', title: 'x'.repeat(181) }
];
for (const input of badCommands) assert.equal(api.buildCommand(input), null);

console.log('github draft PR create boundary tests passed');
