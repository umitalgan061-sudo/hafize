import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const migrated = [
  'canva-oauth-policy',
  'canva-oauth-runtime',
  'canva-read-client',
  'canva-token-exchange',
  'canva-token-refresh',
  'canva-token-revoke',
  'google-oauth-policy',
  'google-oauth-runtime',
  'google-token-exchange',
  'gmail-read-client',
  'gmail-send-contract',
  'gmail-send-tool-boundary',
  'oauth-flow-runtime',
  'oauth-token-store-runtime',
  'oauth-token-file-store',
  'skill-selector',
  'skills-manifest',
  'skills-registry',
  'skills-runtime',
  'connector-capabilities'
];

function assertFile(path) {
  assert.equal(existsSync(join(root, path)), true, `missing migrated file: ${path}`);
}

function assertBridge(name) {
  const path = `lib/${name}.mjs`;
  assertFile(path);
  assert.equal(read(path).trim(), `export * from './${name}.ts';`, `legacy bridge drift: ${path}`);
}

for (const name of migrated) {
  assertFile(`lib/${name}.ts`);
  assertBridge(name);
}

const typedSources = migrated.map((name) => read(`lib/${name}.ts`));

for (const [index, source] of typedSources.entries()) {
  const name = migrated[index];
  assert.equal(source.includes(`from './${name}.mjs'`), false);
  for (const dependency of migrated) {
    if (dependency === name) continue;
    const legacyImport = new RegExp(`from ['"]\\./${dependency}\\.mjs['"]`);
    assert.equal(legacyImport.test(source), false, `legacy dependency import remains in ${name}.ts: ${dependency}`);
  }
}

const canvaRuntime = read('lib/canva-agent-runtime.ts');
const gmailRuntime = read('lib/gmail-agent-runtime.ts');
for (const runtime of [canvaRuntime, gmailRuntime]) {
  assert.doesNotMatch(runtime, /oauth-token-store-runtime\\.mjs/);
  assert.doesNotMatch(runtime, /(?:canva|gmail)-read-client\\.mjs/);
  assert.doesNotMatch(runtime, /(?:canva|gmail)-read-tool-boundary\\.mjs/);
}

const tokenStore = read('lib/oauth-token-file-store.ts');
assert.match(tokenStore, /0o700/);
assert.match(tokenStore, /0o600/);
assert.match(tokenStore, /structuredClone/);
assert.match(tokenStore, /assertInside/);
assert.doesNotMatch(tokenStore, /path\\.join\\([^)]*ownerId/);

const canvaPolicy = read('lib/canva-oauth-policy.ts');
const googlePolicy = read('lib/google-oauth-policy.ts');
for (const policy of [canvaPolicy, googlePolicy]) {
  assert.match(policy, /explicitUserIntent/);
  assert.match(policy, /duplicate_capability/);
  assert.match(policy, /requiresWriteApproval/);
}

const flowRuntime = read('lib/oauth-flow-runtime.ts');
assert.match(flowRuntime, /createPkceVerifier/);
assert.match(flowRuntime, /createOAuthState/);
assert.match(flowRuntime, /createPkceChallenge/);
assert.match(flowRuntime, /normalizeOAuthCallback/);
assert.match(flowRuntime, /store\\.issue/);
assert.match(flowRuntime, /store\\.consume/);

const skillsManifest = read('lib/skills-manifest.ts');
const skillsRegistry = read('lib/skills-registry.ts');
const skillsRuntime = read('lib/skills-runtime.ts');
const skillSelector = read('lib/skill-selector.ts');
for (const source of [skillsManifest, skillsRegistry, skillsRuntime, skillSelector]) {
  assert.doesNotMatch(source, /TODO_REPLACE/);
  assert.doesNotMatch(source, /secret\\.read/);
}
assert.match(skillsManifest, /NEVER_SKILL_TOOLS/);
assert.match(skillsRegistry, /authorizeAgentTool/);
assert.match(skillsRuntime, /createSkillsRegistry/);
assert.match(skillSelector, /scoreSkill/);

const connectorCapabilities = read('lib/connector-capabilities.ts');
assert.match(connectorCapabilities, /CAPABILITY_NAMES/);
assert.match(connectorCapabilities, /github\\.read/);
assert.match(connectorCapabilities, /gmail\\.read/);

const pkg = JSON.parse(read('package.json'));
assert.match(String(pkg.scripts?.['check:modern'] || ''), /test-typescript-platform-wave\\.mjs/);
assert.match(String(pkg.scripts?.typecheck || ''), /tsc/);
assert.equal(pkg.engines?.node, '>=24.21.0');

console.log('TypeScript platform wave release gate: OK');
