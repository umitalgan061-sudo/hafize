import assert from 'node:assert/strict';
import fs from 'node:fs';
const note = fs.readFileSync(new URL('../docs/MESSAGE_MARKDOWN_PR_SUMMARY_2.md', import.meta.url), 'utf8');
assert.ok(note.includes('assistant yanıtlarını güvenli ve okunabilir Markdown'));
assert.ok(note.includes('Rollback'));
console.log('markdown PR note contract ok');
