import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const search = fs.readFileSync(new URL('../public/chat-history-search.js', import.meta.url), 'utf8');
const style = fs.readFileSync(new URL('../public/chat-history-search.css', import.meta.url), 'utf8');
const docs = fs.readFileSync(new URL('../docs/CHAT_HISTORY_SEARCH.md', import.meta.url), 'utf8');

assert.match(index, /chat-history-search\.css/);
assert.match(index, /chat-history-search\.js/);
assert.match(search, /hafize\.conversations\.v1/);
assert.match(search, /conversationSearchInput/);
assert.match(search, /toLocaleLowerCase\('tr-TR'\)/);
// mod tuşu şartı iki eşdeğer biçimde yazılabilir; kısayolun kendisi davranışsal olarak pinlenir.
assert.match(search, /(!event\.ctrlKey && !event\.metaKey|event\.ctrlKey \|\| event\.metaKey)/);
assert.match(search, /event\.altKey/);
// Shift zorunludur: aksi hâlde kısayol tarayıcının kendi mod+f aramasını ele geçirir.
assert.match(search, /event\.shiftKey !== SHORTCUT\.shift/);
assert.equal(/!SHORTCUT\.shift/.test(search), false, 'shift koşulu sabit üzerinden kontrol edilmemeli');
assert.match(search, /event\.key\.toLocaleLowerCase\(\) !== SHORTCUT\.key/);
assert.match(search, /event\.key === 'Escape'/);
assert.match(search, /\.messages/);
assert.match(style, /\.history-search/);
assert.match(style, /\.history-search-status/);
assert.match(docs, /mod\+shift\+f/);
assert.match(docs, /Başlık veya mesaj|mesaj içeriklerini/);

console.log('test-chat-history-search: ok');
