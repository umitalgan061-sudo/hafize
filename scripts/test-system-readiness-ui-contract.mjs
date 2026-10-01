import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL(import.meta.url)), '..');
const source = await readFile(resolve(ROOT, '../public/system-readiness-panel.ts'), 'utf8');
const css = await readFile(resolve(ROOT, '../public/system-readiness.css'), 'utf8');
const index = await readFile(resolve(ROOT, '../public/index.html'), 'utf8');

assert.match(source, /fetchHealth\(/);
assert.match(source, /\/api\/health/);
assert.match(source, /cache:\s*'no-store'/);
assert.match(source, /AbortController/);
assert.match(source, /FETCH_TIMEOUT_MS\s*=\s*8_000/);
assert.match(source, /REFRESH_MS\s*=\s*60_000/);
assert.match(source, /aria-live/);
assert.match(source, /aria-label/);
assert.match(source, /destroy/);
assert.doesNotMatch(source, /localStorage|sessionStorage/);
assert.doesNotMatch(source, /Authorization\s*:/);
assert.doesNotMatch(source, /NVIDIA_API_KEY|GITHUB_TOKEN|HAFIZE_AUTH_TOKEN/);
assert.doesNotMatch(source, /sendBeacon|WebSocket|XMLHttpRequest/);
assert.match(css, /system-readiness-badge/);
assert.match(index, /system-readiness\.css/);
assert.match(index, /typed-build\/system-readiness-panel\.js/);
console.log('system readiness UI report contract passed');
