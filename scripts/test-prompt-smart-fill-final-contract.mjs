import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

const root = process.cwd();
const smartFill = fs.readFileSync(path.join(root, 'public/prompt-library-smart-fill.js'), 'utf8');
const smartCss = fs.readFileSync(path.join(root, 'public/prompt-library-smart-fill.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw-policy.js'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

assert.match(smartFill, /HafizePromptLibrarySmartFill/);
assert.match(smartFill, /promptLibrarySmartFill/);
assert.match(smartFill, /role', 'dialog/);
assert.match(smartFill, /aria-modal/);
assert.match(smartFill, /aria-labelledby/);
assert.match(smartFill, /aria-describedby/);
assert.match(smartFill, /Escape/);
assert.match(smartFill, /stopImmediatePropagation/);
assert.match(smartFill, /replaceVariables/);
assert.match(smartFill, /messageInput/);
assert.match(smartFill, /dispatchEvent\(new Event\('input'/);
assert.match(smartFill, /MAX_VALUE = 1000/);
assert.match(smartFill, /MAX_VARIABLES = 12/);
assert.match(smartFill, /MAX_PRESETS = 6/);
assert.match(smartFill, /MAX_PREVIEW = 8000/);
assert.match(smartFill, /Object\.entries\(preset\.values/);
assert.match(smartFill, /slice\(0, MAX_VARIABLES\)/);
// Values go through the shared clamp helper rather than an inline slice.
assert.match(smartFill, /clamp = \(value, limit\) => String\(value \?\? ''\)\.slice\(0, limit\)/);
assert.match(smartFill, /clamp\([^)]*, MAX_VALUE\)/);
assert.match(smartFill, /localStorage/);
assert.match(smartFill, /hafize\.prompt-library\.smart-fill\.v1/);
assert.match(smartFill, /navigator\?\.clipboard/);
assert.match(smartFill, /setAttribute\('aria-live', 'polite'\)/);
// The dialog traps Tab in both directions so focus never escapes it.
assert.match(smartFill, /event\.key !== 'Tab'/);
assert.match(smartFill, /event\.shiftKey && documentRef\.activeElement === first/);
assert.match(smartFill, /!event\.shiftKey && documentRef\.activeElement === last/);
assert.doesNotMatch(smartFill, /fetch\(/);
assert.doesNotMatch(smartFill, /XMLHttpRequest/);
assert.doesNotMatch(smartFill, /WebSocket/);
assert.doesNotMatch(smartFill, /innerHTML/);
assert.doesNotMatch(smartFill, /outerHTML/);
assert.doesNotMatch(smartFill, /document\.write/);

assert.match(smartCss, /\.prompt-smart-fill\[hidden\]/);
assert.match(smartCss, /max-height/);
assert.match(smartCss, /forced-colors/);
assert.match(smartCss, /prefers-reduced-motion/);
assert.match(smartCss, /focus-visible/);
assert.match(smartCss, /max-width:700px/);

assert.match(index, /prompt-library-smart-fill\.css/);
assert.match(index, /prompt-library-smart-fill\.js/);
const cssPosition = index.indexOf('prompt-library-smart-fill.css');
const jsPosition = index.indexOf('prompt-library-smart-fill.js');
assert.ok(cssPosition >= 0 && jsPosition >= 0 && cssPosition < index.indexOf('</head>'));
assert.ok(jsPosition > index.indexOf('prompt-library.js'));
assert.ok(jsPosition < index.indexOf('voice-input.js'));

assert.match(sw, /prompt-library-smart-fill\.css/);
assert.match(sw, /prompt-library-smart-fill\.js/);
assertVersionedCacheDeclaration(sw);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);

assert.match(readme, /Akıllı doldurma/i);
assert.match(readme, /değişken/i);
assert.match(readme, /cihaz/i);

const unsafePatterns = [
  /credentials/i,
  /Authorization/i,
  /Bearer\s/i,
  /client_secret/i,
  /api[_-]?key/i,
  /secret/i
];
for (const pattern of unsafePatterns) {
  assert.doesNotMatch(smartFill, pattern, `unexpected secret/network token pattern: ${pattern}`);
}

function assertBoundedRecord(record) {
  assert.equal(typeof record, 'object');
  for (const [key, value] of Object.entries(record)) {
    assert.ok(String(key).length <= 32);
    assert.ok(String(value).length <= 1000);
  }
}

const sample = { konu: 'Ankara', ton: 'profesyonel', uzunluk: 'kısa' };
assertBoundedRecord(sample);
assert.ok(Object.values(sample).every((value) => typeof value === 'string'));
assert.ok(Object.keys(sample).length <= 12);

console.log('prompt smart-fill final contract ok');
