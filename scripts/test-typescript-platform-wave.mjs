import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const migrated = [
  'canva-oauth-policy',
  'canva-oauth-runtime',
  'google-oauth-policy',
  'google-oauth-runtime',
  'oauth-flow-runtime',
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

// Verify TypeScript sources don't import .mjs bridges
const typedSources = migrated.map((name) => read(`lib/${name}.ts`));
for (const [index, source] of typedSources.entries()) {
  const name = migrated[index];
  assert.equal(source.includes(`from './${name}.mjs'`), false, `self-import from .mjs in ${name}.ts`);
}

const tokenStore = read('lib/oauth-token-file-store.ts');
assert.match(tokenStore, /0o700/);
assert.match(tokenStore, /0o600/);
assert.match(tokenStore, /structuredClone/);
assert.match(tokenStore, /assertInside/);

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

const skillsManifest = read('lib/skills-manifest.ts');
const skillsRegistry = read('lib/skills-registry.ts');
const skillsRuntime = read('lib/skills-runtime.ts');
const skillSelector = read('lib/skill-selector.ts');
for (const source of [skillsManifest, skillsRegistry, skillsRuntime, skillSelector]) {
  assert.doesNotMatch(source, /TODO_REPLACE/);
}
assert.match(skillsManifest, /NEVER_SKILL_TOOLS/);
assert.match(skillsRegistry, /authorizeAgentTool/);
assert.match(skillsRuntime, /createSkillsRegistry/);
assert.match(skillSelector, /scoreSkill/);

const connectorCapabilities = read('lib/connector-capabilities.ts');
assert.match(connectorCapabilities, /CAPABILITY_NAMES/);

const pkg = JSON.parse(read('package.json'));

console.log('TypeScript platform wave release gate: OK');
