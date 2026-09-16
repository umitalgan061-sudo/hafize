import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
for (const asset of ['/prompt-library.css', '/prompt-library.js', '/prompt-library-starters.js', '/prompt-library-enhancements.js']) assert.match(html, new RegExp(asset.replace('.', '\\.'), 'u'));
for (const asset of ['/prompt-library.css', '/prompt-library.js', '/prompt-library-starters.js', '/prompt-library-enhancements.js']) assert.match(sw, new RegExp(asset.replace('.', '\\.'), 'u'));
assertVersionedCacheDeclaration(sw);
console.log('test-prompt-library-pwa: ok');
