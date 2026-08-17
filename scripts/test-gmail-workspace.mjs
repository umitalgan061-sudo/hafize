import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const workspace = require('../public/gmail-workspace.js');

assert.equal(workspace.MAX_QUERY_CHARS, 120);
assert.equal(workspace.MAX_PROMPT_CHARS, 900);
assert.deepEqual(Object.keys(workspace.PRESETS), ['recent', 'unread', 'important']);

assert.equal(workspace.normalizeSearchQuery('  Ankara   ihale  '), 'Ankara ihale');
assert.equal(workspace.normalizeSearchQuery('a'.repeat(120)), 'a'.repeat(120));
assert.equal(workspace.normalizeSearchQuery('a'.repeat(121)), null);
assert.equal(workspace.normalizeSearchQuery(''), null);
assert.equal(workspace.normalizeSearchQuery(null), null);
assert.equal(workspace.normalizeSearchQuery('hello\u0000world'), null);
assert.equal(workspace.normalizeSearchQuery('satır\nsonu'), 'satır sonu');

const searchPrompt = workspace.buildSearchPrompt('  Ziya   konser  ');
assert.equal(typeof searchPrompt, 'string');
assert.ok(searchPrompt.includes('"Ziya konser"'));
assert.ok(searchPrompt.includes('salt-okunur Gmail araçlarıyla'));
assert.ok(searchPrompt.includes('Hiçbir e-postayı gönderme'));
assert.ok(searchPrompt.length <= workspace.MAX_PROMPT_CHARS);
assert.equal(workspace.buildSearchPrompt('x'.repeat(121)), null);
assert.equal(workspace.buildSearchPrompt('\u0001'), null);

for (const name of ['recent', 'unread', 'important']) {
  const prompt = workspace.normalizePreset(name);
  assert.equal(typeof prompt, 'string');
  assert.ok(prompt.length > 40);
  assert.ok(prompt.length <= workspace.MAX_PROMPT_CHARS);
  assert.match(prompt, /salt-okunur Gmail araçlarıyla/);
  assert.match(prompt, /Hiçbir e-postayı gönderme/);
}
assert.equal(workspace.normalizePreset('send'), null);
assert.equal(workspace.normalizePreset('__proto__'), null);
assert.equal(workspace.normalizePreset(null), null);

assert.equal(workspace.isGmailLinked({ dataset: { state: 'linked' } }), true);
assert.equal(workspace.isGmailLinked({ dataset: { state: 'unlinked' } }), false);
assert.equal(workspace.isGmailLinked(null), false);

assert.equal(workspace.isToolModeEnabled({ getAttribute: () => 'true' }), true);
assert.equal(workspace.isToolModeEnabled({ getAttribute: () => 'false' }), false);
assert.equal(workspace.isToolModeEnabled(null), false);

assert.equal(workspace.isStreaming({ classList: { contains: (value) => value === 'streaming' } }), true);
assert.equal(workspace.isStreaming({ classList: { contains: () => false } }), false);
assert.equal(workspace.isStreaming(null), false);

console.log('gmail workspace helper tests passed');
