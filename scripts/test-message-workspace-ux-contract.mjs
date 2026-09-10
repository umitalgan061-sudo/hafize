import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compactCss, hasMediaQuery } from './check-support.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const js = await read('public/message-workspace.js');
const css = await read('public/message-workspace.css');
const html = await read('public/index.html');

const buttons = [
  ['message-save', 'Mesajı kaydet'],
  ['message-feedback-up', 'Yanıtı beğen'],
  ['message-feedback-down', 'Yanıtı beğenme'],
  ['message-note', 'Mesaja not ekle'],
  ['message-tag', 'Mesaja etiket ekle'],
  ['message-more', 'Mesaj çalışma alanı seçenekleri']
];
for (const [className, label] of buttons) {
  assert.ok(js.includes(className), `missing action class: ${className}`);
  assert.ok(js.includes(`'${label}'`), `missing action label: ${label}`);
}

assert.ok(js.includes("button.type = 'button'"));
assert.ok(js.includes("button.setAttribute('aria-label', label)"));
assert.ok(js.includes("save?.setAttribute('aria-pressed', String(record?.saved === true))"));
assert.ok(js.includes("up?.setAttribute('aria-pressed', String(record?.feedback === 'up'))"));
assert.ok(js.includes("down?.setAttribute('aria-pressed', String(record?.feedback === 'down'))"));
assert.ok(js.includes("status.setAttribute('role','status')"));
assert.ok(js.includes("status.setAttribute('aria-live','polite')"));

// Declarations are compared without whitespace so formatting stays free.
const cssRules = compactCss(css);
assert.ok(cssRules.includes('.message-workspace-action:focus-visible'));
assert.ok(cssRules.includes('.message-workspace-search:focus'));
assert.ok(cssRules.includes('.message-workspace-select:focus'));
assert.ok(cssRules.includes('overflow-wrap:anywhere'));
assert.ok(cssRules.includes('overscroll-behavior:contain'));
assert.ok(cssRules.includes('min-width:0'));
assert.ok(cssRules.includes('width:100%'));

for (const feature of ['max-width:1100px', 'max-width:900px', 'max-width:560px', 'prefers-reduced-motion:reduce', 'forced-colors:active']) {
  assert.ok(hasMediaQuery(css, feature), `missing media guard: ${feature}`);
}

const source = `${compactCss(js)}\n${cssRules}`;
for (const forbidden of ['pointer-events:none', 'user-select:none', 'outline:none', 'display:none!important']) {
  assert.equal(source.includes(forbidden), false, `accessibility-hostile CSS detected: ${forbidden}`);
}

assert.ok(html.includes('aria-label="Sohbet mesajları"'));
assert.ok(html.includes('aria-label="Hafize yardımcı araçları"'));
assert.ok(html.includes('class="utility-rail"'));

const flowTokens = [
  'ensureActionBar(article)',
  'updateActionState(article)',
  'renderResults()',
  'focusMessage(entry)',
  'removeRecord(entry.record.id)'
];
for (const token of flowTokens) assert.ok(js.includes(token));

assert.ok(js.includes("if (!entries.length)"));
assert.ok(js.includes("'Bu görünümde kayıtlı mesaj yok.'"));
assert.ok(js.includes("'Önce en az bir mesaj seç.'"));
assert.ok(js.includes("'Mesaj artık görünür değil; kayıt yerel geçmişte kaldı.'"));

console.log('message workspace UX contract tests passed');
