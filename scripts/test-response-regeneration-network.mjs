import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/typed/app-shell.ts','utf8');
const segment=source.slice(source.indexOf('async function regenerateAssistantMessage'),source.indexOf('function restorePreviousAssistantMessage'));
assert.match(segment,/fetch\(endpoint/);
assert.doesNotMatch(segment,/https?:\/\//);
assert.doesNotMatch(segment,/navigator\.sendBeacon/);
console.log('response regeneration network boundary ok');