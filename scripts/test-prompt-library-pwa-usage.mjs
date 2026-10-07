import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertVersionedCacheDeclaration, assertModuleDelivered } from './shell-cache-contract.mjs';

const sw = fs.readFileSync('public/sw-policy.ts', 'utf8');
const enhancements = fs.readFileSync('public/typed/legacy/prompt-library-enhancements.ts', 'utf8');
const usage = fs.readFileSync('public/typed/legacy/prompt-library-usage.ts', 'utf8');

assertVersionedCacheDeclaration(sw);
assertModuleDelivered('prompt-library-usage');
assert.match(sw, /if \(pathname\.startsWith\('\/api\/'\)\) return 'network-only'/);
assert.match(sw, /SHELL_PATHS = new Set\(SHELL_ASSETS\)/);
// The usage layer is imported by the legacy entry instead of being injected as a
// script at runtime, so the order in that entry is the contract.
const legacyEntry = fs.readFileSync('public/typed/legacy-app.ts', 'utf8');
const enhancementsPos = legacyEntry.indexOf('./legacy/prompt-library-enhancements.ts');
const usagePos = legacyEntry.indexOf('./legacy/prompt-library-usage.ts');
assert.ok(enhancementsPos >= 0 && usagePos > enhancementsPos, 'usage loads after the enhancements layer');
assert.doesNotMatch(enhancements, /script\.src = '\/prompt-library-usage\.js'/, 'no leftover runtime injection of a bundled module');
assert.match(usage, /const STORAGE_KEY = 'hafize\.prompt-library\.v1'/);
assert.match(usage, /root\.HafizePromptLibraryUsage = api/);
assert.match(usage, /MutationObserver/);
console.log('prompt-library usage PWA contracts: ok');
