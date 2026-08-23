import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');

assert.match(source, /banner\.setAttribute\('role', 'status'\)/);
assert.match(source, /sourceButton\.type = 'button'/);
assert.match(source, /sourceButton\.textContent = 'Kaynak sohbeti aç'/);
assert.match(source, /label\.textContent = `\$\{mode\}\$\{depthText\}\$\{siblingText\} · kaynak sohbet korunuyor`/);
assert.match(source, /\.conversation-branch-source:focus-visible\{outline:2px solid/);
assert.match(source, /@media\(max-width:620px\)/);
assert.match(source, /\.conversation-branch-source\{min-height:44px\}/);
assert.match(source, /@media\(forced-colors:active\)/);

assert.doesNotMatch(source, /aria-label[^\n]*(?:content|title|message)/i);
assert.doesNotMatch(source, /label\.innerHTML|banner\.innerHTML|sourceButton\.innerHTML/);
assert.doesNotMatch(source, /conversation\.title/);
assert.doesNotMatch(source, /message\.content/);

const renderAt = source.indexOf('function render()');
const activeAt = source.indexOf('function activeConversationId()');
const openAt = source.indexOf('function openSource()');
assert.ok(activeAt >= 0 && renderAt > activeAt && openAt >= 0);
assert.match(source.slice(openAt, renderAt), /entry\.parentConversationId/);
assert.match(source.slice(openAt, renderAt), /\.conversation-open/);
assert.match(source.slice(openAt, renderAt), /open\.click\(\)/);

console.log('conversation branch lineage accessibility contract: ok');
