import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const drained = server.indexOf('await httpClose;');
const gmailClose = server.indexOf('await GMAIL_AGENT_RUNTIME.close();');
assert.ok(drained >= 0 && gmailClose > drained, 'Gmail Redis must close only after active HTTP requests drain');
assert.match(server, /console\.error\('Hafize Gmail runtime shutdown failed'\)/);
assert.equal(server.includes('HAFIZE_GOOGLE_REFRESH_REDIS_URL'), false, 'server shutdown logs must not expose Redis config');
assert.equal((server.match(/await GMAIL_AGENT_RUNTIME\.close\(\);/g) || []).length, 1);
console.log('Google refresh shutdown wiring tests passed');
