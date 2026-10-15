import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertBundledModule } from './legacy-bundle-contract.mjs';

const html = fs.readFileSync('public/index.html','utf8');
assert.match(html,/prompt-library-smart-views\.css/);
assert.match(html,/prompt-library-smart-views-extras\.css/);
assertBundledModule('prompt-library-smart-views');
assertBundledModule('prompt-library-smart-views-history');
assertBundledModule('prompt-library-smart-views-builder');
console.log('smart-view index integration: ok');