import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../public/chat-history-export.js', import.meta.url), 'utf8');
const style = fs.readFileSync(new URL('../public/chat-history-export.css', import.meta.url), 'utf8');

assert.match(index, /chat-history-export\.css/);
assert.match(index, /chat-history-export\.js/);
assert.match(source, /hafize\.conversations\.v1/);
assert.match(source, /buildMarkdown/);
assert.match(source, /buildJson/);
assert.match(source, /application\/json;charset=utf-8/);
assert.match(source, /text\/markdown;charset=utf-8/);
assert.match(source, /URL\.createObjectURL/);
assert.match(source, /URL\.revokeObjectURL/);
assert.match(source, /anchor\.download/);
assert.match(style, /\.history-export/);
assert.match(style, /\.history-export-btn/);

console.log('test-chat-history-export: ok');
