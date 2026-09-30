import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s = readFileSync('vite.config.ts','utf8');
assert.match(s,/replaceAll\('\/typed-build\/conversation-forks\.js', '\/typed\/conversation-forks\.ts'\)/);
assert.match(s,/conversation-forks.*conversation-forks\.ts/);
assert.doesNotMatch(s,/smart-fill-hints\.ts'\);\n        \.replaceAll/);
console.log('conversation fork Vite chain: ok');