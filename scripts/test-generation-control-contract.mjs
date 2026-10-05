import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const generation = await read('public/typed/generation-control.ts');
const history = await read('public/typed/generation-history.ts');
const app = await read('public/typed/app-shell.ts');
const html = await read('public/index.html');
const sw = await read('public/sw-policy.ts');

assert.match(generation, /new AbortController\(\)/);
assert.match(generation, /activeController\.abort/);
assert.match(generation, /HAFIZE_GENERATION_CONTROL_SHORTCUT/);
assert.match(generation, /hafizeGenerationStop/);
assert.match(generation, /copyDiagnostics/);
assert.match(generation, /readHistory/);
assert.match(history, /GENERATION_HISTORY_LIMIT = 12/);
assert.match(history, /metadata-only|prompt|response/);
assert.match(app, /generationControl\.begin/);
assert.match(app, /signal: generationRun\.signal/);
assert.match(app, /generationControl\.progress/);
assert.match(app, /generationControl\.stop\('offline'\)/);
assert.match(html, /generation-control\.css/);
assert.match(sw, /generation-control\.css/);
console.log('generation-control contract: OK');
