import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertBrowserModuleShipped } from './browser-bundle-contract.mjs';

const html = fs.readFileSync('public/index.html','utf8');
assert.match(html,/prompt-library-smart-views\.css/);
assert.match(html,/prompt-library-smart-views-extras\.css/);
assertBrowserModuleShipped('prompt-library-smart-views');
assertBrowserModuleShipped('prompt-library-smart-views-history');
assertBrowserModuleShipped('prompt-library-smart-views-builder');
console.log('smart-view index integration: ok');