import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/connector-hub.js', 'utf8');

assert.match(source, /HEALTH_URL = ['"]\/api\/health/);
assert.match(source, /GMAIL_STATUS_URL = ['"]\/api\/connectors\/gmail\/status/);
assert.match(source, /CANVA_STATUS_URL = ['"]\/api\/connectors\/canva\/status/);
assert.match(source, /method:\s*['"]GET['"]/);
assert.match(source, /credentials:\s*['"]same-origin['"]/);
assert.match(source, /headers:\s*\{\s*accept:\s*['"]application\/json['"]/);
assert.match(source, /AbortController/);
assert.match(source, /REQUEST_TIMEOUT_MS\s*=\s*8000/);
assert.match(source, /REFRESH_COOLDOWN_MS\s*=\s*900/);
assert.match(source, /Promise\.all\(\[/);
assert.match(source, /refreshInFlight/);
assert.match(source, /lastRefreshAt/);
assert.match(source, /connectorHubMarker/);
assert.match(source, /accountConnectionCard/);
assert.match(source, /gmailConnectionCard/);
assert.match(source, /canvaConnectionCard/);
assert.match(source, /githubWriteReadinessCard/);
assert.match(source, /rootRef\.dispatchEvent/);
assert.match(source, /destroy:/);

console.log('connector hub contract: passed');