import assert from 'node:assert/strict';
import fs from 'node:fs';

const builder=fs.readFileSync('public/typed/legacy/prompt-library-smart-views-builder.ts','utf8');
assert.match(builder,/event\.key\.toLowerCase\(\) !== 'q'/);
assert.match(builder,/event\.ctrlKey \|\| event\.metaKey/);
assert.match(builder,/matches\?\.\('input,textarea,select/);
console.log('smart-view shortcut contract: ok');