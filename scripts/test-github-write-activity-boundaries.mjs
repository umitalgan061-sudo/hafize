import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/github-write-activity.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/github-write-activity.css', import.meta.url));
const [source, css] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(cssPath, 'utf8')
]);

for (const forbidden of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /document\.cookie/,
  /navigator\.clipboard/,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon/,
  /api\.github\.com/i,
  /Authorization/i,
  /approvalToken/,
  /GITHUB_TOKEN/,
  /HAFIZE_.*(?:TOKEN|KEY|SECRET)/,
  /innerHTML/,
  /outerHTML/,
  /insertAdjacentHTML/,
  /\bshell\s*:\s*true\b/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `activity UI must not expose forbidden surface: ${forbidden}`);
}

assert.match(source, /const MAX_ITEMS = 12/);
assert.match(source, /const MAX_BRANCH_CHARS = 120/);
assert.match(source, /const MAX_PATH_CHARS = 400/);
assert.match(source, /const MOUNT_TIMEOUT_MS = 10_000/);
assert.match(source, /items = appendItem\(items, item\)/);
assert.match(source, /items = \[\]/);
assert.match(source, /Bu kayıt yalnız bu sayfa oturumunda tutulur/);
assert.match(source, /Kalıcı log değildir\. Token veya dosya içeriği tutulmaz\./);
assert.match(source, /textContent/);
assert.match(source, /replaceChildren/);
assert.match(source, /rootRef\.addEventListener\(name, onWriteEvent\)/);
assert.match(source, /rootRef\.removeEventListener\(name, onWriteEvent\)/);
assert.match(source, /observer\.observe\(documentRef\.body, \{ childList: true, subtree: true \}\)/);
assert.match(source, /rootRef\.setTimeout/);
assert.match(source, /rootRef\.clearTimeout/);

assert.match(css, /min-height: 44px/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(css, /forced-colors: active/);
assert.match(css, /focus-visible/);
assert.match(css, /font-variant-numeric: tabular-nums/);

console.log('github write activity boundary tests passed');
