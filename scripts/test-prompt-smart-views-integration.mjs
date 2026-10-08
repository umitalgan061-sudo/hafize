import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertLegacyModulesBundled } from './legacy-bundle-contract.mjs';

const html = fs.readFileSync('public/index.html','utf8');
assert.match(html,/prompt-library-smart-views\.css/);
assert.match(html,/prompt-library-smart-views-extras\.css/);
assertLegacyModulesBundled(['prompt-library-smart-views', 'prompt-library-smart-views-builder', 'prompt-library-smart-views-history']);
console.log('smart-view index integration: ok');