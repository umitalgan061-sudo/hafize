// Bootstrap contract: an already-loaded Prompt Library enhancement may load the
// optional Markdown renderer without rewriting the current main HTML shell.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-revisions-enhancements.js', 'utf8');
assert.match(source, /chat-markdown\.css/);
assert.match(source, /markdown-renderer\.js/);
assert.match(source, /chat-markdown\.js/);
assert.match(source, /createElement\(['"]link['"]/);
assert.match(source, /createElement\(['"]script['"]/);
assert.match(source, /rel\s*=\s*['"]stylesheet['"]/);
assert.match(source, /defer\s*=\s*true/);
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /innerHTML\s*=/);

console.log('chat markdown loader contract: ok');
