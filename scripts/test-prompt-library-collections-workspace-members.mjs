import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');

assert.match(source, /function promptRecords\(\)/);
assert.match(source, /function validPromptIds\(\)/);
assert.match(source, /function promptMap\(\)/);
assert.match(source, /function membersFor\(collection, workspace\)/);
assert.match(source, /core\(\)\?\.removeMembers/);
assert.match(source, /core\(\)\?\.addMembers/);
assert.match(source, /selectedPrompts/);
assert.match(source, /slice\(0, MAX_SELECTED\)/);
assert.match(source, /Üye istem ara…/);
assert.match(source, /Seçili istemleri ekle/);
assert.match(source, /Üyeleri seç/);
assert.match(source, /Aramayla eşleşen üye yok\./);
assert.match(source, /Bu koleksiyonda istem yok\./);
assert.match(source, /prompt-library-collection-member-preview/);

console.log('prompt collection workspace members: ok');
