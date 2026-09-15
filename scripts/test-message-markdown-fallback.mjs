import assert from 'node:assert/strict';
import fs from 'node:fs';

const enhancement = fs.readFileSync(new URL('../public/message-markdown-enhancement.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/composer-history-help.js', import.meta.url), 'utf8');
assert.ok(enhancement.includes('if (!node || !root.HafizeMarkdown) return;'));
assert.ok(enhancement.includes('if (install()) return;'));
assert.ok(enhancement.includes('if (retry >= 12) return;'));
assert.ok(loader.includes("if (doc.querySelector(`[data-hafize-asset=\"${href}\"]`)) return;"));
assert.ok(loader.includes("doc.head?.append(node)"));
assert.ok(!enhancement.includes('throw new Error'));
assert.ok(!loader.includes('fetch('));
console.log('message markdown fallback contract ok');
