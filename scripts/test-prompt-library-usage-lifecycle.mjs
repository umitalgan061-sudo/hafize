import assert from 'node:assert/strict';
import fs from 'node:fs';

const usage = fs.readFileSync('public/prompt-library-usage.js', 'utf8');
const enhancements = fs.readFileSync('public/prompt-library-enhancements.js', 'utf8');

assert.match(usage, /if \(!documentRef \|\| !card \|\| documentRef\.getElementById\(INSIGHTS_ID\)\) return null/);
assert.match(usage, /documentRef\.getElementById\(INSIGHTS_ID\)/);
assert.match(usage, /section\.id = INSIGHTS_ID/);
assert.match(usage, /section\.setAttribute\('aria-labelledby', 'promptLibraryUsageTitle'\)/);
assert.match(usage, /toggle\.setAttribute\('aria-expanded', 'true'\)/);
assert.match(usage, /body\.hidden = hidden/);
assert.match(usage, /toggle\.setAttribute\('aria-expanded', String\(!hidden\)\)/);
assert.match(usage, /rootRef\.clearTimeout\?\.\(timer\)/);
assert.match(usage, /observer\?\.disconnect\(\)/);
assert.match(usage, /rootRef\.removeEventListener\?\.\('storage', onStorage\)/);
assert.match(usage, /section\.remove\(\)/);
assert.match(usage, /return Object\.freeze\(\{/);
assert.match(usage, /refresh: render/);
assert.match(usage, /summarize: \(\) => summarize\(readItems\(rootRef\)\)/);
// The usage panel is no longer injected by `prompt-library-enhancements.js`:
// index.html loads `/prompt-library-usage.js` as a deferred script, and the
// module mounts itself. The contract is the static load plus that bootstrap.
assert.match(usage, /root\.HafizePromptLibraryUsage = api/);
assert.match(usage, /if \(root\.document\?\.readyState === 'loading'\)/);
assert.match(enhancements, /function inject\(src, attr, value\)/);
console.log('prompt-library usage lifecycle contracts: ok');
