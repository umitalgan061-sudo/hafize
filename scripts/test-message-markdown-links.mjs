import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../public/message-markdown.js', import.meta.url), 'utf8');
assert.ok(file.includes("const URL_PATTERN = /^(https?:\\/\\/|mailto:)[^\\s<>]+$/i;"));
assert.ok(file.includes("new URL(url, root.location?.origin || 'http://localhost')"));
assert.ok(file.includes("parsed.protocol"));
assert.ok(file.includes("'http:', 'https:', 'mailto:'"));
assert.ok(file.includes("link.target = '_blank'"));
assert.ok(file.includes("link.rel = 'noopener noreferrer'"));
assert.ok(file.includes("const href = safeUrl(input.slice(close + 2, end));"));
assert.ok(file.includes('if (href)'));
console.log('message markdown link policy ok');
