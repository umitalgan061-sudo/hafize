import assert from 'node:assert/strict';
import fs from 'node:fs';

const policy=fs.readFileSync('public/composer-attachments-policy.js','utf8');
const runtime=fs.readFileSync('public/composer-attachments.js','utf8');
const scanner=fs.readFileSync('public/composer-attachments-secret-scan.js','utf8');

assert.match(policy,/function normalizeContent/);
assert.match(policy,/function sliceLines/);
assert.match(policy,/function formatRangeForComposer/);
assert.match(policy,/includes\('```'\)/);
assert.match(runtime,/api\.formatRangeForComposer/);
assert.match(runtime,/api\.sliceLines/);
assert.match(runtime,/input\.value = before \+ payload \+ after/);
assert.match(runtime,/input\.setSelectionRange/);
assert.match(runtime,/const onUndo/);
assert.match(runtime,/navigator\?\.clipboard/);
assert.match(scanner,/function scan/);
assert.match(scanner,/MAX_MATCHES/);
assert.match(scanner,/RULE_IDS/);

assert.doesNotMatch(runtime,/localStorage/);
assert.doesNotMatch(runtime,/sessionStorage/);
assert.doesNotMatch(runtime,/fetch\s*\(/);
assert.doesNotMatch(scanner,/fetch\s*\(/);
assert.doesNotMatch(policy,/fetch\s*\(/);

console.log('composer attachment content contract: ok');