import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const app = read('public/app.js');
const features = read('public/chat-composer-features.js');
const css = read('public/chat-composer-features.css');
const html = read('public/index.html');

assert.match(app, /let editingMessageId = null;/);
assert.match(app, /function getEditableMessage\(id\)/);
assert.match(app, /function beginMessageEdit\(id\)/);
assert.match(app, /function cancelMessageEdit\(\)/);
assert.match(app, /function replaceEditedTurn\(id, content\)/);
assert.match(app, /messages = target\.conversation\.messages\.slice\(0, target\.index\)/);
assert.match(app, /window\.addEventListener\('hafize:edit-message'/);
// app.js listens for the edit request; chat-composer-features.js dispatches it.
assert.match(features, /new CustomEvent\('hafize:edit-message'/);
assert.match(features, /detail: \{ messageId \}/);
assert.match(app, /if \(editingMessageId\) \{/);
assert.match(app, /replaceEditedTurn\(editingMessageId, clean\)/);
assert.match(app, /event\.key === 'Escape' && editingMessageId/);
assert.match(app, /aria-label', 'Mesaj düzenlemeyi iptal et'/);
assert.match(app, /className = 'composer-editing'/);
assert.match(app, /Yanıt sürerken mesaj düzenlenemez/);
assert.match(app, /bu noktadan sonraki yanıtlar yeniden oluşturulacak/);

assert.match(features, /function enhanceUserArticle\(article\)/);
assert.match(features, /article\.classList\.contains\('user'\)/);
assert.match(features, /const messageId = article\.dataset\.messageId/);
assert.match(features, /textContent = 'Düzenle'/);
assert.match(features, /aria-label', 'Kullanıcı mesajını düzenle'/);
assert.match(features, /title = 'Bu mesajı düzenle ve yeniden gönder'/);
assert.match(features, /window\.dispatchEvent\(new CustomEvent\('hafize:edit-message'/);
assert.match(features, /className = 'message-actions'/);
assert.match(features, /detail: \{ messageId \}\s*\}\)\);/);
assert.doesNotMatch(features, /assistant.*Düzenle/);

assert.match(css, /\.composer-editing\s*\{/);
assert.match(css, /justify-content:\s*space-between/);
assert.match(css, /\.composer-editing \.message-action/);
assert.match(css, /@media \(max-width: 560px\)/);
assert.match(css, /prefers-reduced-motion/);

assert.match(html, /id="messageInput"/);
assert.match(html, /id="composer"/);
assert.match(html, /chat-composer-features\.css/);
assert.match(html, /chat-composer-features\.js/);

function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} bulunamadı`);
  let depth = 0;
  let seenBrace = false;
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
      seenBrace = true;
    } else if (char === '}' && seenBrace) {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${name} gövdesi kapanmadı`);
}

const replaceTurn = extractFunction(app, 'replaceEditedTurn');
const editStart = extractFunction(app, 'beginMessageEdit');
const cancelEdit = extractFunction(app, 'cancelMessageEdit');

assert.match(replaceTurn, /getEditableMessage\(id\)/);
assert.match(replaceTurn, /slice\(0, target\.index\)/);
assert.match(replaceTurn, /role: 'user'/);
assert.match(replaceTurn, /editingMessageId = null/);
assert.match(replaceTurn, /saveConversations\(\)/);
assert.match(replaceTurn, /render\(\)/);
assert.match(editStart, /isStreaming/);
assert.match(editStart, /target\.message\.content/);
assert.match(editStart, /ui\.messageInput\.select\(\)/);
assert.match(cancelEdit, /editingMessageId = null/);
assert.match(cancelEdit, /ui\.messageInput\.value = ''/);

const userEnhance = extractFunction(features, 'enhanceUserArticle');
assert.match(userEnhance, /messageId/);
assert.match(userEnhance, /new CustomEvent\('hafize:edit-message'/);
assert.match(userEnhance, /type = 'button'/);

console.log('test-chat-message-edit: all source-contract assertions passed');
