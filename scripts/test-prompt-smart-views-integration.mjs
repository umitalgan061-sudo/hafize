import assert from 'node:assert/strict';
import fs from 'node:fs';

import { assertModuleDelivered } from './shell-cache-contract.mjs';
const html = fs.readFileSync('public/index.html','utf8');
assert.match(html,/prompt-library-smart-views\.css/);
assert.match(html,/prompt-library-smart-views-extras\.css/);
assertModuleDelivered('prompt-library-smart-views');
assertModuleDelivered('prompt-library-smart-views-history');
assertModuleDelivered('prompt-library-smart-views-builder');
console.log('smart-view index integration: ok');