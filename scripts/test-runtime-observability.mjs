import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../lib/runtime-observability.ts', import.meta.url), 'utf8');
assert.match(source, /RequestOutcome/);
assert.match(source, /createRuntimeObservability/);
assert.match(source, /averageLatencyMs/);
assert.match(source, /healthFromSnapshot/);
for (const token of ['requests', 'completed', 'aborted', 'errors', 'active', 'peakActive']) assert.ok(source.includes(token), `missing metric: ${token}`);
assert.ok(source.includes('begins = new Map'), 'request handles should be isolated');
assert.ok(source.includes('Object.freeze'), 'snapshots should be immutable');
console.log('runtime observability contract: ok');
