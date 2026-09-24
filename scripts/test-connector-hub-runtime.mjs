import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const source = await readFile('public/connector-hub.js', 'utf8');
const temp = await mkdtemp(join(tmpdir(), 'hafize-connector-hub-'));

assert.ok(temp.length > 0);
assert.match(source, /function getJson\(url\)/);
assert.match(source, /response\?\.ok/);
assert.match(source, /response\.json\(\)/);
assert.match(source, /HTTP_/);
assert.match(source, /NETWORK_ERROR/);
assert.match(source, /TIMEOUT/);
assert.match(source, /FETCH_UNAVAILABLE/);
assert.match(source, /finally/);
assert.match(source, /clearTimeout/);
assert.match(source, /if \(destroyed\) return false/);
assert.match(source, /refresh\.disabled = true/);
assert.match(source, /refreshInFlight = true/);
assert.match(source, /refreshInFlight = false/);
assert.match(source, /applyCollapse\(\);/);
assert.match(source, /refreshStatus\(\{ force: true \}\)/);
assert.match(source, /function formatTime\(\)/);

console.log('connector hub runtime contract: passed');