import assert from 'node:assert/strict';
import fs from 'node:fs';

import { assertModuleDelivered } from './shell-cache-contract.mjs';
const html=fs.readFileSync('public/index.html','utf8');
const sw=fs.readFileSync('public/sw-policy.ts','utf8');
const core=fs.readFileSync('public/typed/prompt-library.ts','utf8');
assert.match(core,/const STORAGE_KEY = 'hafize\.prompt-library\.v1'/);
assertModuleDelivered('prompt-library-smart-views');
assertModuleDelivered('prompt-library-smart-views');
assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);
assert.doesNotMatch(html,/type="module" src="\/prompt-library-smart-views/);
console.log('smart-view compatibility contract: ok');