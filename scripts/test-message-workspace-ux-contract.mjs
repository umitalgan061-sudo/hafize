import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
// Sınıf adı JS'te literal olarak geçmelidir; her sınıf ayrıca `.` seçiciyle sorgulanmak zorunda değildir.
for (const [className, label] of buttons) {
  assert.ok(js.includes(`'${className}'`), `missing class literal ${className}`);
  assert.ok(js.includes(`'${label}'`), `missing aria label ${label}`);
}

assert.ok(js.includes("button.type = 'button'"));
assert.ok(js.includes("button.setAttribute('aria-label', label)"));
assert.ok(js.includes("save?.setAttribute('aria-pressed', String(record?.saved === true))"));
assert.ok(js.includes("up?.setAttribute('aria-pressed', String(record?.feedback === 'up'))"));
assert.ok(js.includes("down?.setAttribute('aria-pressed', String(record?.feedback === 'down'))"));
assert.ok(js.includes("status.setAttribute('role','status')"));
assert.ok(js.includes("status.setAttribute('aria-live','polite')"));

// CSS iddiaları biçimlendirme boşluklarına duyarlı olmamalıdır.
const compact = (value) => value.replace(/\s+/g, '');
const compactCss = compact(css);
const hasCss = (needle) => compactCss.includes(compact(needle));
assert.ok(hasCss('.message-workspace-action:focus-visible'));
assert.ok(hasCss('.message-workspace-search:focus'));
assert.ok(hasCss('.message-workspace-select:focus'));
assert.ok(hasCss('overflow-wrap:anywhere'));
assert.ok(hasCss('overscroll-behavior:contain'));
assert.ok(hasCss('min-width:0'));
assert.ok(hasCss('width:100%'));

assert.ok(hasCss('@media (max-width:1100px)'));
assert.ok(hasCss('@media (max-width:900px)'));
assert.ok(hasCss('@media (max-width:560px)'));
assert.ok(hasCss('@media (prefers-reduced-motion:reduce)'));
assert.ok(hasCss('@media (forced-colors:active)'));

const compactSource = compact(`${js}\n${css}`);
for (const forbidden of ['pointer-events:none', 'user-select:none', 'outline:none', 'display:none!important']) {
  assert.equal(compactSource.includes(compact(forbidden)), false, `accessibility-hostile CSS detected: ${forbidden}`);
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
