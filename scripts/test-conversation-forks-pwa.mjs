import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fs=require('node:fs');
const html=fs.readFileSync('public/index.html','utf8');
const sw=fs.readFileSync('public/sw-policy.ts','utf8');
const vite=fs.readFileSync('vite.config.ts','utf8');
assert.match(html,/conversation-forks\.css/);
assert.match(html,/typed-build\/conversation-forks\.js/);
assert.match(sw,/conversation-forks\.css/);
assert.match(sw,/typed-build\/conversation-forks\.js/);
assert.match(vite,/conversation-forks/);
console.log('conversation fork PWA contract: ok');