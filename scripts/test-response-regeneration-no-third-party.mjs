import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/app-shell.ts','utf8');
const segment=s.slice(s.indexOf('async function regenerateAssistantMessage'),s.indexOf('function setAssistantFeedback'));
assert.doesNotMatch(segment,/https?:\/\//);
assert.doesNotMatch(segment,/sendBeacon/);
assert.doesNotMatch(segment,/WebSocket/);
console.log('response third-party boundary ok');