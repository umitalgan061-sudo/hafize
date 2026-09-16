import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
for (const expression of [
  /MAX_REVISIONS_PER_PROMPT = 20/,
  /MAX_REVISIONS_TOTAL = 600/,
  /MAX_TITLE = 100/,
  /MAX_BODY = 8000/,
  /MAX_TAGS = 8/,
  /MAX_TAG = 24/,
  /MAX_REASON = 160/,
  /MAX_ID = 120/,
  /slice\(0, MAX_REVISIONS_TOTAL\)/,
  /slice\(0, MAX_TAGS\)/,
  /Math\.min\(9999/,
  /return null;/
]) assert.match(source, expression);
assert.doesNotMatch(source, /MAX_REVISIONS_TOTAL = 6000/);
assert.doesNotMatch(source, /document\.cookie/);
assert.doesNotMatch(source, /navigator\.sendBeacon/);
console.log('prompt library revision bounds: ok');
