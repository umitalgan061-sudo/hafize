import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';
import { assertLegacyModulesBundled } from './legacy-bundle-contract.mjs';

const sw = fs.readFileSync('public/sw-policy.ts', 'utf8');
const enhancements = fs.readFileSync('public/typed/legacy/prompt-library-enhancements.ts', 'utf8');
const usage = fs.readFileSync('public/typed/legacy/prompt-library-usage.ts', 'utf8');

assertVersionedCacheDeclaration(sw);
assert.match(sw, /if \(pathname\.startsWith\('\/api\/'\)\) return 'network-only'/);
assert.match(sw, /SHELL_PATHS = new Set\(SHELL_ASSETS\)/);
assert.match(enhancements, /script\.defer = true/);
assert.match(enhancements, /data-hafize-prompt-usage/);
assert.match(usage, /const STORAGE_KEY = 'hafize\.prompt-library\.v1'/);
assert.match(usage, /root\.HafizePromptLibraryUsage = api/);
assert.match(usage, /MutationObserver/);
assertLegacyModulesBundled(['prompt-library-usage']);
console.log('prompt-library usage PWA contracts: ok');
