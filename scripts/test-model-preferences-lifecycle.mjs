import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'public/typed/model-preferences-ui.ts'), 'utf8');
assert.match(source, /return Object\.freeze\(\{/);
assert.match(source, /refresh:/);
assert.match(source, /destroy:/);
assert.match(source, /addEventListener\('change', onModelOrAgentChange\)/);
assert.match(source, /removeEventListener\('change', onModelOrAgentChange\)/);
assert.match(source, /document\.addEventListener\('keydown', keyboard\)/);
assert.match(source, /document\.removeEventListener\('keydown', keyboard\)/);
assert.match(source, /open\.remove\(\)/);
assert.match(source, /dialog\.panel\.remove\(\)/);
console.log('model preferences lifecycle contract ok');
