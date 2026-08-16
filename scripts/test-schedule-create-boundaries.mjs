import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/schedule-create.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/schedule-create.css', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/SCHEDULE_CREATE_UI_CONTRACT.md', import.meta.url));
const [source, css, doc] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(cssPath, 'utf8'),
  readFile(docPath, 'utf8')
]);

for (const forbidden of [
  /localStorage/,
  /sessionStorage/,
  /indexedDB/,
  /document\.cookie/,
  /navigator\.clipboard/,
  /WebSocket/,
  /EventSource/,
  /sendBeacon/,
  /innerHTML/,
  /Authorization\s*:/,
  /Bearer\s+/,
  /HAFIZE_.*(?:TOKEN|KEY|SECRET)/,
  /shell=True/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `forbidden schedule-create surface: ${forbidden}`);
}

assert.equal(source.includes("method: 'POST'"), true);
assert.equal(source.includes("credentials: 'same-origin'"), true);
assert.equal(source.includes("cache: 'no-store'"), true);
assert.equal(source.includes("documentRef.querySelector?.('#agentSelect')"), true);
assert.equal(source.includes("event.preventDefault()"), true);
assert.equal(source.includes("Date.parse(input.runAt) <= now().getTime()"), true);
assert.equal(source.includes("root.dispatchEvent?.(new root.CustomEvent(CREATED_EVENT))"), true);
assert.equal(source.includes('nodes.form.reset()'), true);
assert.equal(source.includes("nodes.task.focus?.()"), true);
assert.equal(source.includes("event?.key === 'Escape'"), true);
assert.equal(source.includes("nodes.form.setAttribute('aria-busy'"), true);

assert.match(css, /@media \(max-width: 680px\)/);
assert.match(css, /min-height: 44px/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors: active/);
assert.match(css, /focus-visible/);

assert.match(doc, /açık bir form gönderimi/i);
assert.match(doc, /backend default-deny/i);
assert.match(doc, /same-origin/i);
assert.match(doc, /localStorage/i);
assert.match(doc, /1–5/);
assert.match(doc, /4000/);
assert.match(doc, /ayrıca onay/i);

console.log('schedule create boundary tests passed');
