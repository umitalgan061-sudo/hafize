import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/local-data-center.js', 'utf8');
for (const key of [
  'hafize.conversations.v1',
  'hafize.chat-drafts.v1',
  'hafize.prompt-library.v1',
  'hafize.prompt-library.v1.state',
  'hafize.composer-history.v1',
  'hafize.composer-history.settings.v1',
  'hafize.theme.v1',
  'hafize.reduced-motion.v1'
]) assert.match(source, new RegExp(key.replaceAll('.', '\\.' )));
assert.match(source, /KNOWN_KEYS/);
assert.match(source, /unknownKeys/);
assert.match(source, /clearAllKnown/);
assert.match(source, /MAX_READ = 1_500_000/);
assert.doesNotMatch(source, /sessionStorage/);
assert.doesNotMatch(source, /indexedDB/);
console.log('local data center policy: ok');
