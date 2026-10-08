import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertModuleShipped, assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

const sw = fs.readFileSync('public/sw-policy.ts', 'utf8');
const enhancements = fs.readFileSync('public/typed/legacy/prompt-library-enhancements.ts', 'utf8');
const usage = fs.readFileSync('public/typed/legacy/prompt-library-usage.ts', 'utf8');

assertVersionedCacheDeclaration(sw);
assertModuleShipped('prompt-library-usage');
assert.match(sw, /if \(pathname\.startsWith\('\/api\/'\)\) return 'network-only'/);
assert.match(sw, /SHELL_PATHS = new Set\(SHELL_ASSETS\)/);
// The enhancements module no longer injects script tags at runtime: the usage
// module is imported statically by the legacy entry, so a lazy `<script>` would
// only 404.
assert.doesNotMatch(enhancements, /script\.src = /);
assert.doesNotMatch(enhancements, /createElement\('script'\)/);
assert.match(usage, /const STORAGE_KEY = 'hafize\.prompt-library\.v1'/);
assert.match(usage, /root\.HafizePromptLibraryUsage = api/);
assert.match(usage, /MutationObserver/);
console.log('prompt-library usage PWA contracts: ok');
