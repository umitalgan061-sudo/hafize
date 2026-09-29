import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences-ui.ts'),'utf8');
assert.match(source,/const STORAGE_KEY = 'hafize\.model-preferences\.v1'/);
assert.match(source,/const onStorage = \(event: StorageEvent\)/);
assert.match(source,/event\.key !== STORAGE_KEY/);
assert.match(source,/globalThis\.addEventListener\('storage', onStorage\)/);
assert.match(source,/globalThis\.removeEventListener\('storage', onStorage\)/);
console.log('model preferences cross-tab sync ok');
