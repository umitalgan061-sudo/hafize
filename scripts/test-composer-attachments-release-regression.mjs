import assert from 'node:assert/strict';
import fs from 'node:fs';

const files={
  policy:fs.readFileSync('public/composer-attachments-policy.js','utf8'),
  scanner:fs.readFileSync('public/composer-attachments-secret-scan.js','utf8'),
  runtime:fs.readFileSync('public/composer-attachments.js','utf8'),
  css:fs.readFileSync('public/composer-attachments.css','utf8'),
  index:fs.readFileSync('public/index.html','utf8'),
  sw:fs.readFileSync('public/sw-policy.js','utf8')
};

const requiredPolicy=['MAX_FILES','MAX_BYTES','MAX_TEXT_CHARS','MAX_COMBINED_CHARS','MAX_INSERT_CHARS','MAX_RANGE_LINES','validateFile','normalizeContent','sliceLines','formatRangeForComposer'];
const requiredRuntime=['Dosya ekleri','Seçilenleri mesaja ekle','Son eklemeyi geri al','Önizleme','Hızlı analiz','quickPrompts','runQuickAction','input.dispatchEvent','MEMORY_TTL_MS','destroy'];
const requiredScanner=['RULE_IDS','MAX_MATCHES','MAX_SCAN_CHARS','function scan','function summary'];
const requiredCss=['composer-attachments-panel','composer-attachment-row','composer-attachment-range','composer-attachments-quick-actions','composer-attachment-risk','forced-colors:active','prefers-reduced-motion:reduce'];

for(const token of requiredPolicy) assert.ok(files.policy.includes(token),`missing policy token ${token}`);
for(const token of requiredRuntime) assert.ok(files.runtime.includes(token),`missing runtime token ${token}`);
for(const token of requiredScanner) assert.ok(files.scanner.includes(token),`missing scanner token ${token}`);
for(const token of requiredCss) assert.ok(files.css.includes(token),`missing css token ${token}`);

assert.ok(files.index.includes('/composer-attachments.css'));
assert.ok(files.index.includes('/composer-attachments-policy.js'));
assert.ok(files.index.includes('/composer-attachments-secret-scan.js'));
assert.ok(files.index.includes('/composer-attachments.js'));
assert.ok(files.index.indexOf('/composer-attachments-policy.js')<files.index.indexOf('/composer-attachments-secret-scan.js'));
assert.ok(files.index.indexOf('/composer-attachments-secret-scan.js')<files.index.indexOf('/composer-attachments.js'));

assert.ok(files.sw.includes('/composer-attachments.css'));
assert.ok(files.sw.includes('/composer-attachments-policy.js'));
assert.ok(files.sw.includes('/composer-attachments-secret-scan.js'));
assert.ok(files.sw.includes('/composer-attachments.js'));
assert.match(files.sw,/CURRENT_CACHE.*v37/);

for(const source of [files.policy,files.scanner,files.runtime]){
  assert.doesNotMatch(source,/XMLHttpRequest/);
  assert.doesNotMatch(source,/WebSocket/);
  assert.doesNotMatch(source,/sendBeacon/);
}
assert.doesNotMatch(files.runtime,/fetch\s*\(/);
assert.doesNotMatch(files.runtime,/localStorage|sessionStorage|indexedDB/);
assert.doesNotMatch(files.runtime,/innerHTML|outerHTML/);
assert.doesNotMatch(files.runtime,/requestSubmit|\.submit\s*\(/);

assert.match(files.runtime,/api\.validateFile\(file, items\)/);
assert.match(files.runtime,/return api\.readText\(file\)/);
assert.ok(files.runtime.indexOf('api.validateFile(file, items)')<files.runtime.indexOf('api.readText(file)'));

assert.match(files.runtime,/api\.binaryScore\(content\)/);
assert.match(files.runtime,/api\.MAX_COMBINED_CHARS/);
assert.match(files.runtime,/api\.MAX_FILES/);
assert.match(files.runtime,/api\.MAX_RANGE_LINES/);
assert.match(files.runtime,/api\.MAX_INSERT_CHARS/);

assert.match(files.runtime,/rootRef\.confirm/);
assert.match(files.runtime,/Hassas içerik uyarısı/);
assert.match(files.runtime,/Son eklemeyi geri al/);
assert.match(files.runtime,/navigator\?\.clipboard/);
assert.match(files.runtime,/selectionStart/);
assert.match(files.runtime,/selectionEnd/);
assert.match(files.runtime,/input\.setSelectionRange/);

assert.match(files.runtime,/data-attachment-quick-action/);
assert.match(files.runtime,/summary/);
assert.match(files.runtime,/review/);
assert.match(files.runtime,/bugs/);
assert.match(files.runtime,/requirements/);

assert.match(files.css,/max-width:700px/);
assert.match(files.css,/focus-visible/);
assert.match(files.css,/forced-colors:active/);

console.log('composer attachment release regression: ok');