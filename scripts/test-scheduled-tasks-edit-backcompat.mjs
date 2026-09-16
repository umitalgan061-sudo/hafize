import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const store=await readFile(new URL('../lib/task-schedule-store.mjs',import.meta.url),'utf8');
const persistence=await readFile(new URL('../lib/task-schedule-persistence.mjs',import.meta.url),'utf8');
assert.ok(store.includes("const STATUSES = new Set(['scheduled', 'running', 'completed', 'failed', 'cancelled'])"));
assert.ok(persistence.includes('const SCHEMA_VERSION = 1'));
assert.ok(persistence.includes('claimDue'));
assert.ok(persistence.includes('cancel'));
console.log('scheduled task edit backward compatibility ok');
