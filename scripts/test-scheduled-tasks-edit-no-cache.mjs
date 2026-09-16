import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
assert.ok(server.includes("Cache-Control', 'no-store'"));
assert.ok(server.includes('SCHEDULE_HTTP_API.handle'));
assert.ok(sw.includes("if (pathname.startsWith('/api/')) return 'network-only';"));
assert.ok(!sw.includes("'/api/schedules'"));
console.log('scheduled task edit no-cache policy ok');
