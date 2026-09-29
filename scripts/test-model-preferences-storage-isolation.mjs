import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences.ts'),'utf8');
assert.match(source,/hafize\.model-preferences\.v1/);
assert.match(source,/setItem\(MODEL_PREFERENCES_STORAGE_KEY/);
assert.match(source,/removeItem\(MODEL_PREFERENCES_STORAGE_KEY/);
assert.doesNotMatch(source,/hafize\.conversations\.v1/);
assert.doesNotMatch(source,/hafize\.prompt-library\.v1/);
console.log('model preferences storage isolation ok');
