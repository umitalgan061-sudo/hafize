import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/schedule-list.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/schedule-list.css', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/SCHEDULE_LIST_UI_CONTRACT.md', import.meta.url));
const [source, css, doc] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(cssPath, 'utf8'),
  readFile(docPath, 'utf8')
]);

const syntax = spawnSync(process.execPath, ['--check', sourcePath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

for (const forbidden of [
  /method:\s*['"]POST['"]/,
  /method:\s*['"]PATCH['"]/,
  /method:\s*['"]DELETE['"]/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/i,
  /document\.cookie/,
  /navigator\.clipboard/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon/,
  /Authorization/i,
  /Bearer\s/i,
  /innerHTML/,
  /outerHTML/,
  /insertAdjacentHTML/,
  /\.traceId\b/,
  /\.lastError\b/,
  /\.ownerId\b/,
  /\.retryDelayMs\b/
]) {
  assert.equal(forbidden.test(source), false, `schedule list exposes forbidden surface: ${forbidden}`);
}

assert.match(source, /const PATH = '\/api\/schedules'/);
assert.match(source, /method: 'GET'/);
assert.match(source, /credentials: 'same-origin'/);
assert.match(source, /cache: 'no-store'/);
assert.match(source, /MAX_ITEMS = 100/);
assert.match(source, /MAX_TASK_PREVIEW_CHARS = 180/);
assert.match(source, /MAX_AGENT_ID_CHARS = 120/);
assert.match(source, /MAX_SCHEDULE_ID_CHARS = 120/);
assert.match(source, /STATUSES = Object\.freeze\(new Set\(\['scheduled', 'running', 'completed', 'failed', 'cancelled'\]\)\)/);
assert.match(source, /task\.textContent = item\.task/);
assert.match(source, /meta\.textContent =/);
assert.match(source, /status\.setAttribute\('role', 'status'\)/);
assert.match(source, /status\.setAttribute\('aria-live', 'polite'\)/);
assert.match(source, /card\.setAttribute\('aria-busy', 'false'\)/);
assert.match(source, /attributeFilter: \['data-state'\]/);
assert.match(source, /next === 'loading'/);
assert.match(source, /response\.status === 401/);
assert.match(source, /renderEmpty\('Cloud oturumu gerekli\.'\)/);
assert.match(source, /requestGeneration \+= 1/);
assert.match(source, /observer\?\.disconnect/);

assert.match(css, /@media \(max-width: 680px\)/);
assert.match(css, /min-height: 40px/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /@media \(forced-colors: active\)/);
assert.match(css, /max-height: 320px/);

assert.match(doc, /salt-okunur/i);
assert.match(doc, /GET \/api\/schedules/);
assert.match(doc, /owner subject/i);
assert.match(doc, /POST\/PATCH\/DELETE/i);
assert.match(doc, /traceId/);
assert.match(doc, /lastError/);
assert.match(doc, /100/);
assert.match(doc, /180/);

console.log('schedule list boundary tests passed');
