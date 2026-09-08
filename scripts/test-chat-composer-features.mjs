import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const composer = await readFile(new URL('../public/chat-composer-features.js', import.meta.url), 'utf8');
const shell = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const serviceWorkerPolicy = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const style = await readFile(new URL('../public/chat-composer-features.css', import.meta.url), 'utf8');

assert.match(composer, /MAX_FILE_BYTES = 384 \* 1024/);
assert.match(composer, /MAX_ATTACHMENTS = 3/);
assert.match(composer, /MAX_ATTACHMENT_TEXT = 9000/);
assert.match(composer, /ACCEPTED_EXTENSIONS/);
assert.match(composer, /file\.text\(\)/);
assert.match(composer, /input\.multiple = true/);
assert.match(composer, /input\.accept =/);
assert.match(composer, /input\.addEventListener\('change'/);
assert.match(composer, /dataTransfer\?\.files/);
assert.match(composer, /clipboardData\?\.files/);
assert.match(composer, /navigator\.clipboard\.writeText/);
assert.match(composer, /document\.execCommand\('copy'\)/);
assert.match(composer, /Hafize yanıtını kopyala/);
assert.match(composer, /Bu kullanıcı isteğini yeniden gönder/);
assert.match(composer, /ui\.composer\.requestSubmit\(\)/);
assert.match(composer, /ui\.composer\.addEventListener\('submit', clearAttachments, true\)/);
assert.match(composer, /lastIndexOf\(file\.block\)/);
assert.match(composer, /Dosya sunucuya ayrı bir yükleme olarak gönderilmedi/);
assert.doesNotMatch(composer, /fetch\(/, 'feature must remain client-local and avoid a second upload endpoint');

assert.match(shell, /chat-composer-features\.css/);
assert.match(shell, /chat-composer-features\.js/);
assert.match(shell, /title="Metin veya kod dosyası ekle"/);
assert.ok(shell.indexOf('/chat-composer-features.js') > shell.indexOf('/app.js'));

assert.match(style, /\.attachment-strip/);
assert.match(style, /\.attachment-chip/);
assert.match(style, /\.attachment-remove/);
assert.match(style, /\.composer\.drag-active/);
assert.match(style, /\.message-actions/);
assert.match(style, /\.message-action/);

assert.match(serviceWorkerPolicy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v16`/);
assert.match(serviceWorkerPolicy, /'\/chat-composer-features\.css'/);
assert.match(serviceWorkerPolicy, /'\/chat-composer-features\.js'/);

const attachmentBlock = composer.match(/\[Ekli dosya: \$\{file\.name\}\]/);
assert.ok(attachmentBlock);
assert.ok(composer.includes('MAX_FILE_BYTES'));
assert.ok(composer.includes('MAX_ATTACHMENTS'));
assert.ok(composer.includes('MAX_ATTACHMENT_TEXT'));

console.log('chat composer feature contract passed: local file attachments, copy/retry actions and PWA shell wiring');
