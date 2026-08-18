import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/schedule-list-filter.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/schedule-list-filter.css', import.meta.url), 'utf8');
const uiShell = await readFile(new URL('../public/ui-shell.js', import.meta.url), 'utf8');

for (const forbidden of [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'sendBeacon',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'document.cookie',
  'navigator.clipboard',
  'innerHTML',
  'outerHTML',
  'insertAdjacentHTML',
  'eval(',
  'Function(',
  'child_process',
  'exec(',
  'spawn(',
  'shell=True'
]) {
  assert.equal(source.includes(forbidden), false, `forbidden schedule filter surface: ${forbidden}`);
}

for (const secretName of [
  'Authorization',
  'Bearer ',
  'GITHUB_TOKEN',
  'NVIDIA_API_KEY',
  'GOOGLE_CLIENT_SECRET',
  'CANVA_CLIENT_SECRET',
  'HAFIZE_CLOUD_SESSION_SIGNING_KEY',
  'ownerId',
  'traceId',
  'lastError'
]) {
  assert.equal(source.includes(secretName), false, `secret/internal field must stay outside filter: ${secretName}`);
}

assert.match(source, /MAX_QUERY_CHARS\s*=\s*120/);
assert.match(source, /AUTO_MOUNT_TIMEOUT_MS\s*=\s*10_000/);
assert.match(source, /\.schedule-list-agent/);
assert.match(source, /\.schedule-list-task/);
assert.match(source, /dataset\?\.state/);
assert.match(source, /article\.hidden\s*=\s*!matches/);
assert.match(source, /aria-hidden/);
assert.match(source, /MutationObserver/);
assert.match(source, /attributeFilter:\s*\['data-state'\]/);
assert.match(source, /requestAnimationFrame/);
assert.match(source, /Escape/);

assert.equal(source.includes('/api/'), false, 'filter must not own an API route');
assert.equal(source.includes('scheduleId'), false, 'filter must not inspect schedule identity');
assert.equal(source.includes('data-schedule-id'), false, 'filter must not inspect schedule identity attributes');
assert.equal(source.includes('data-max-attempts'), false, 'filter must not inspect retry metadata');

assert.match(css, /min-height:\s*44px/);
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /forced-colors:\s*active/);
assert.match(css, /\[hidden\]/);
assert.equal(css.includes('url('), false, 'filter CSS must not load external assets');

assert.match(uiShell, /SCHEDULE_LIST_FILTER_SCRIPT\s*=\s*'\/schedule-list-filter\.js'/);
assert.match(uiShell, /installScheduleListFilterAsset\(documentRef\)/);
assert.match(uiShell, /script\.src\s*=\s*SCHEDULE_LIST_FILTER_SCRIPT/);
assert.match(uiShell, /script\.async\s*=\s*false/);
assert.equal(uiShell.includes('schedule-list-filter.js?'), false, 'loader must use a fixed same-origin asset path');

console.log('schedule list filter security tests passed');