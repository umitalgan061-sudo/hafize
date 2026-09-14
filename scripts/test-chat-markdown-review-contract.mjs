import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
const rules = [
  [/SAFE_PROTOCOLS/, 'protocol allowlist'],
  [/new URL\(/, 'URL parsing'],
  [/noopener noreferrer nofollow/, 'external link hardening'],
  [/maxInput/, 'input bound'],
  [/maxBlocks/, 'block bound'],
  [/maxListItems/, 'list bound'],
  [/maxTableRows/, 'row bound'],
  [/maxTableColumns/, 'column bound'],
  [/maxInline/, 'inline bound'],
  [/maxCodeLines/, 'code bound'],
  [/textContent/, 'text sink'],
  [/replaceChildren/, 'DOM replacement'],
  [/MutationObserver/, 'stream observer'],
  [/markdownWriting/, 'observer reentrancy guard'],
  [/markdownSource/, 'source equality guard']
];
for (const [pattern, name] of rules) assert.match(source, pattern, name);

for (const dangerous of [
  /innerHTML\s*=/i,
  /outerHTML\s*=/i,
  /insertAdjacentHTML/i,
  /document\.write\s*\(/i,
  /document\.cookie/i,
  /localStorage/i,
  /sessionStorage/i,
  /\bfetch\s*\(/i,
  /XMLHttpRequest/i,
  /WebSocket/i,
  /Authorization/i,
  /Bearer\s+/i,
  /createElement\(['"]script/i,
  /createElement\(['"]iframe/i,
  /createElement\(['"]img/i
]) assert.doesNotMatch(source, dangerous);

console.log('test-chat-markdown-review-contract: ok');
