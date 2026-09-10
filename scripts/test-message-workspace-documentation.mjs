import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = {
  guide: await readFile(path.join(root, 'docs/MESSAGE_WORKSPACE.md'), 'utf8'),
  security: await readFile(path.join(root, 'docs/MESSAGE_WORKSPACE_SECURITY.md'), 'utf8'),
  runbook: await readFile(path.join(root, 'docs/MESSAGE_WORKSPACE_RUNBOOK.md'), 'utf8'),
  decisions: await readFile(path.join(root, 'docs/MESSAGE_WORKSPACE_DECISIONS.md'), 'utf8'),
  support: await readFile(path.join(root, 'docs/MESSAGE_WORKSPACE_SUPPORT.md'), 'utf8'),
  readme: await readFile(path.join(root, 'README.md'), 'utf8')
};

for (const [name, text] of Object.entries(files)) {
  assert.ok(text.length > 500, `${name} documentation unexpectedly short`);
  assert.match(text, /Mesaj Çalışma Alanı/);
}

for (const token of ['hafize.message-workspace.v1','240','600','8','100','localStorage','JSON']) {
  assert.ok(files.guide.includes(token), `guide missing ${token}`);
  assert.ok(files.security.includes(token), `security missing ${token}`);
}

for (const token of ['npm run precheck','npm run check','Cross-tab smoke','Storage bozulması','Erişilebilirlik','Geri alma']) {
  assert.ok(files.runbook.includes(token), `runbook missing ${token}`);
}

for (const token of ['Ayrı metadata storage','Neden backend yok','Neden model geri beslemesi yok','Neden MutationObserver','Service worker']) {
  assert.ok(files.decisions.includes(token), `decision missing ${token}`);
}

for (const token of ['Panel görünmüyorsa','Kayıt kayboluyorsa','Export dosyası yoksa','Feedback davranışı','Performans notları']) {
  assert.ok(files.support.includes(token), `support missing ${token}`);
}

for (const token of [
  '## Mesaj çalışma alanı',
  'hafize.message-workspace.v1',
  'Ctrl / ⌘ + Shift + B',
  'test-message-workspace-policy.mjs',
  'test-message-workspace-adversarial.mjs'
]) assert.ok(files.readme.includes(token), `README missing ${token}`);

assert.equal(files.security.includes('fetch'), true);
assert.equal(files.security.includes('XMLHttpRequest'), true);
assert.equal(files.security.includes('WebSocket'), true);
assert.equal(files.security.includes('document.cookie'), true);
assert.equal(files.security.includes('Authorization'), true);

console.log('message workspace documentation coverage tests passed');
