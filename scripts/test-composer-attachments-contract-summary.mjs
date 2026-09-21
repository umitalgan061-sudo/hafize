import assert from 'node:assert/strict';
import fs from 'node:fs';

const policy=fs.readFileSync('public/composer-attachments-policy.js','utf8');
const runtime=fs.readFileSync('public/composer-attachments.js','utf8');
const scanner=fs.readFileSync('public/composer-attachments-secret-scan.js','utf8');
const css=fs.readFileSync('public/composer-attachments.css','utf8');

assert.match(policy,/MAX_FILES = 4/);
assert.match(policy,/MAX_BYTES = 256 \* 1024/);
assert.match(policy,/MAX_TEXT_CHARS = 80_000/);
assert.match(policy,/MAX_COMBINED_CHARS = 200_000/);
assert.match(policy,/MAX_INSERT_CHARS = 11_500/);
assert.match(policy,/MAX_PREVIEW_LINES = 12/);
assert.match(policy,/MAX_RANGE_LINES = 400/);
assert.match(policy,/function normalizeContent/);
assert.match(policy,/function lineCount/);
assert.match(policy,/function sliceLines/);
assert.match(policy,/function formatRangeForComposer/);
assert.match(policy,/function binaryScore/);

assert.match(scanner,/MAX_SCAN_CHARS = 80_000/);
assert.match(scanner,/MAX_MATCHES = 12/);
assert.match(scanner,/function scan/);
assert.match(scanner,/function summary/);
assert.match(scanner,/private-key/);
assert.match(scanner,/github-token/);
assert.match(scanner,/aws-access-key/);
assert.match(scanner,/google-key/);
assert.match(scanner,/slack-token/);
assert.match(scanner,/jwt/);

assert.match(runtime,/validateFile\(file, items\)/);
assert.match(runtime,/readText\(file\)/);
assert.match(runtime,/api\.binaryScore/);
assert.match(runtime,/api\.totalChars/);
assert.match(runtime,/api\.formatRangeForComposer/);
assert.match(runtime,/selectionStart/);
assert.match(runtime,/selectionEnd/);
assert.match(runtime,/lastInsertion/);
assert.match(runtime,/onUndo/);
assert.match(runtime,/navigator\?\.clipboard/);
assert.match(runtime,/data-attachment-quick-action/);
assert.match(runtime,/Hassas içerik uyarısı/);
assert.match(runtime,/rootRef\.confirm/);
assert.match(runtime,/MEMORY_TTL_MS/);
assert.match(runtime,/clearTimeout/);
assert.match(runtime,/destroy:/);
assert.doesNotMatch(runtime,/innerHTML|outerHTML/);
assert.doesNotMatch(runtime,/localStorage|sessionStorage|indexedDB/);
assert.doesNotMatch(runtime,/fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
assert.doesNotMatch(runtime,/requestSubmit|\.submit\s*\(/);

assert.match(css,/composer-attachments-panel/);
assert.match(css,/composer-attachment-range/);
assert.match(css,/composer-attachment-risk/);
assert.match(css,/composer-attachments-quick-actions/);
assert.match(css,/forced-colors:active/);
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(css,/focus-visible/);

console.log('composer attachment contract summary: ok');