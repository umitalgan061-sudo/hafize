import assert from 'node:assert/strict';
import fs from 'node:fs';

const enhancement = fs.readFileSync(new URL('../public/message-markdown-enhancement.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/composer-history-help.js', import.meta.url), 'utf8');
assert.ok(enhancement.includes('HafizeMarkdownPreferences'));
assert.ok(enhancement.includes("hafize:markdown-rendering-preference"));
assert.ok(enhancement.includes('restoreNode'));
assert.ok(enhancement.includes('preferenceEnabled() ? renderNode(node) : restoreNode(node)'));
assert.ok(loader.includes('/message-markdown-preferences.js'));
console.log('markdown preference integration contract ok');
