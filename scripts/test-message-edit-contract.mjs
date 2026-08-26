import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const paths = ['../public/message-edit.js', '../docs/MESSAGE_EDIT_SECURITY.md', '../agents/registry.json']
  .map((p) => fileURLToPath(new URL(p, import.meta.url)));
const [source, doc, registryText] = await Promise.all(paths.map((p) => readFile(p, 'utf8')));
const registry = JSON.parse(registryText);

for (const phrase of [
  'otomatik submit yapılmaz',
  'farklı gönderilmemiş bir taslak',
  'en fazla 12.000 karakterdir',
  'eski mesajı yerinde değiştirmez',
  'backend default-deny',
  '/api/*'
]) assert.equal(doc.includes(phrase), true, `security contract must document: ${phrase}`);

assert.equal(source.includes('requestSubmit('), false, 'edit-to-draft must never submit automatically');
assert.equal(source.includes('fetch('), false, 'edit-to-draft must not create network path');
assert.equal(source.includes('input.value = handoff.text'), true, 'restored edit handoff must populate the composer without submitting');
assert.equal(source.includes("typeof input.value === 'string' && input.value.trim()"), true, 'any existing unsent draft must be preserved before editing');
assert.equal(source.includes("classList?.contains('streaming')"), true, 'active generation must block edit');
assert.equal(source.includes('text.length > MAX_COMPOSER_CHARS'), true);
assert.equal(source.includes("article.classList.contains('user')"), true, 'only user messages may expose edit control');

assert.equal(registry.agents.length, 4, 'message edit must not expand the agent roster');
assert.deepEqual(registry.agents.map((agent) => agent.id), [
  'minimal-engineer',
  'agency-code-reviewer',
  'movie-coordinator',
  'handyman-advisor'
]);
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);

console.log('message edit security contract tests passed');
