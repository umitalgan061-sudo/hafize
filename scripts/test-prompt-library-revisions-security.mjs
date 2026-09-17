import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
for (const pattern of [
  /Object\.freeze\(/,
  /MAX_REVISIONS_PER_PROMPT = 20/,
  /MAX_REVISIONS_TOTAL = 600/,
  /normalizeSnapshot/,
  /normalizeRevision/,
  /JSON\.parse/,
  /storage\?\.setItem/,
  /return null;/,
  /return false;/,
  /confirm/,
  /textContent/
]) assert.match(source, pattern);
for (const forbidden of [/innerHTML\s*=/, /outerHTML/, /document\.write/, /sendBeacon/, /XMLHttpRequest/, /WebSocket/, /fetch\s*\(/, /Authorization/]) {
  assert.doesNotMatch(source, forbidden);
}
console.log('prompt revision security contract: ok');
