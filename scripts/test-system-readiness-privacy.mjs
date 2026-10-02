import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `..` from the script file is the scripts directory; the repository root is one level above it.
const ROOT = resolve(fileURLToPath(new URL(import.meta.url)), '..', '..');
const panel = await readFile(resolve(ROOT, 'public/system-readiness-panel.ts'), 'utf8');
const service = await readFile(resolve(ROOT, 'lib/system-readiness.ts'), 'utf8');
const config = await readFile(resolve(ROOT, 'lib/config-readiness.ts'), 'utf8');

assert.doesNotMatch(panel, /document\.cookie/);
assert.doesNotMatch(panel, /localStorage|sessionStorage/);
assert.doesNotMatch(panel, /indexedDB/i);
assert.doesNotMatch(panel, /sendBeacon|WebSocket|XMLHttpRequest/);
assert.doesNotMatch(service, /process\.env\.HAFIZE_AUTH_TOKEN/);
assert.doesNotMatch(service, /process\.env\.NVIDIA_API_KEY/);
assert.match(config, /secretVariables/);
assert.match(config, /SECRET_CONTAINS_NEWLINE/);
assert.doesNotMatch(config, /console\.log\(.*SECRET/);
assert.match(panel, /String\(value \?\? ''\)/);
assert.match(panel, /labels\[key\] \|\| key/);
assert.ok((panel.match(/textContent/g) || []).length >= 7);
console.log('system readiness privacy checks passed');
