import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL(import.meta.url)), '../..');
const server = await readFile(resolve(ROOT, 'server.ts'), 'utf8');

const healthBlock = server.slice(server.indexOf("url.pathname === '/api/health'"), server.indexOf("url.pathname === '/api/connectors/canva/status'"));
assert.ok(healthBlock.length > 0);
// The route calls a local wrapper, so assert the wrapper is wired to the typed
// builder and that the health block actually uses it.
assert.match(server, /const buildReadinessReport = \(\) => buildSystemReadiness\(\{/);
assert.match(server, /import \{ buildSystemReadiness \} from '\.\/lib\/system-readiness\.ts';/);
assert.match(healthBlock, /const readiness = buildReadinessReport\(\);/);
assert.match(healthBlock, /readiness/);
assert.match(healthBlock, /nvidiaConfigured/);
assert.match(healthBlock, /githubReadConfigured/);
assert.match(healthBlock, /githubWriteConfigured/);
assert.match(healthBlock, /scheduleApiConfigured/);
assert.match(healthBlock, /agents:/);
assert.doesNotMatch(healthBlock, /NVIDIA_API_KEY\s*:/);
assert.doesNotMatch(healthBlock, /GITHUB_TOKEN\s*:/);
assert.doesNotMatch(healthBlock, /HAFIZE_AUTH_TOKEN\s*:/);
assert.doesNotMatch(healthBlock, /Authorization\s*:/);
assert.match(server, /GET' && url\.pathname === '\/api\/health'/);
console.log('system readiness API contract checks passed');
