import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const readme=fs.readFileSync(path.join(process.cwd(),'README.md'),'utf8');
assert.match(readme,/## Model ve ajan tercihleri/);
assert.match(readme,/hafize\.model-preferences\.v1/);
assert.match(readme,/Ctrl \/ ⌘ \+ Shift \+ M/);
assert.match(readme,/200 KB/);
console.log('model preferences README contract ok');
