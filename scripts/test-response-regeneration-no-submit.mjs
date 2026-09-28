import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/typed/app-shell.ts','utf8');
const start=source.indexOf("const regenerate =");
const end=source.indexOf("const generation =",start);
const block=source.slice(start,end);
assert.doesNotMatch(block,/requestSubmit|\.submit\(/);
assert.match(source,/isStreaming/);
console.log('response action no-submit contract ok');