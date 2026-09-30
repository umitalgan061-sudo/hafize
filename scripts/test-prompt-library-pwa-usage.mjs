import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

const sw = fs.readFileSync('public/sw-policy.js', 'utf8');
const enhancements = fs.readFileSync('public/prompt-library-enhancements.js', 'utf8');
const usage = fs.readFileSync('public/prompt-library-usage.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');

assertVersionedCacheDeclaration(sw);
assert.match(sw, /\/prompt-library-usage\.js/);
assert.match(sw, /if \(pathname\.startsWith\('\/api\/'\)\) return 'network-only'/);
assert.match(sw, /SHELL_PATHS = new Set\(SHELL_ASSETS\)/);
// The usage panel is no longer injected by `prompt-library-enhancements.js`:
// index.html loads `/prompt-library-usage.js` as a deferred script, and the
// module mounts itself. The contract is the static load plus that bootstrap.
assert.match(index, /<script src="\/prompt-library-usage\.js" defer><\/script>/);
assert.match(enhancements, /script\.defer = true/);
assert.match(usage, /const STORAGE_KEY = 'hafize\.prompt-library\.v1'/);
assert.match(usage, /root\.HafizePromptLibraryUsage = api/);
assert.match(usage, /const start = \(\) => mount\(root\.document, root\)/);
assert.match(usage, /MutationObserver/);
console.log('prompt-library usage PWA contracts: ok');
