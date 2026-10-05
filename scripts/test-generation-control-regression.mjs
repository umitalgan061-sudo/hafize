import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const app = await readFile(new URL('../public/typed/app-shell.ts', import.meta.url), 'utf8');

const abortBranch = app.indexOf("code === 'SSE_ABORTED' || code === 'AbortError'");
assert.ok(abortBranch >= 0, 'abort branch missing');
const abortBlock = app.slice(abortBranch, abortBranch + 1500);

assert.match(abortBlock, /showToast\('Yanıt üretimi durduruldu\.'\)/);
assert.match(abortBlock, /conversation\.messages = conversation\.messages\.filter/);
assert.match(abortBlock, /saveConversations\(\)/);
assert.match(app, /Yeniden üretme durduruldu; önceki yanıt korundu\./);
assert.match(app, /generationControl\.stop\('offline'\)/);
console.log('generation-control regression contract: OK');
