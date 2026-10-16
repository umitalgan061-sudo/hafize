import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/typed/legacy/scheduled-task-preview.ts', import.meta.url), 'utf8');

assert.match(js, /function payloadFor/);
assert.match(js, /agentId: data\.agentId/);
assert.match(js, /task: data\.task/);
assert.match(js, /runAt: new Date\(data\.localWhen\)\.toISOString\(\)/);
assert.match(js, /maxAttempts: data\.attempts/);
assert.match(js, /JSON\.stringify\(payloadFor\(data\), null, 2\)/);
assert.match(js, /Güvenli özeti kopyala/);
assert.match(js, /toggle-payload/);
assert.doesNotMatch(js, /token/i);
assert.doesNotMatch(js, /password/i);
console.log('scheduled-task-preview-payload: ok');
