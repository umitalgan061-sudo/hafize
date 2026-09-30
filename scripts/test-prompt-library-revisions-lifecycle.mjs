import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(source, /function mount\(/);
assert.match(source, /MutationObserver/);
assert.match(source, /observer\?\.observe/);
assert.match(source, /observer\?\.disconnect/);
// Optional-call form: `addEventListener?.('storage', onStorage)`. The previous
// pattern left out the call parenthesis, so it never matched the real source.
assert.match(source, /addEventListener\?\.\('storage', onStorage\)/);
assert.match(source, /removeEventListener\?\.\('storage', onStorage\)/);
assert.match(source, /destroy:/);
assert.match(source, /section\.remove\(\)/);
// The transient status timer is cancelled on destroy, so a detached panel
// leaves no pending callback behind.
assert.match(source, /statusTimer = rootRef\.setTimeout\?\./);
assert.match(source, /rootRef\.clearTimeout\?\.\(statusTimer\)/);
assert.match(source, /replaceChildren/);
assert.doesNotMatch(source, /setInterval/);
assert.doesNotMatch(source, /setInterval\(/);
assert.match(source, /DOMContentLoaded/);
console.log('prompt revision lifecycle contract: ok');
