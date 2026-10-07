import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertShippedBrowserModule } from './shell-cache-contract.mjs';

const html = fs.readFileSync('public/index.html','utf8');
assert.match(html,/prompt-library-smart-views\.css/);
assert.match(html,/prompt-library-smart-views-extras\.css/);
assertShippedBrowserModule('prompt-library-smart-views');
assertShippedBrowserModule('prompt-library-smart-views-history');
assertShippedBrowserModule('prompt-library-smart-views-builder');
console.log('smart-view index integration: ok');