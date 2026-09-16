import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/composer-history-panel.js', 'utf8');

// The panel builds every node through the element API and writes user text with
// textContent, so a stored submission can never be parsed as markup.
assert.match(source, /doc\.createElement\(tag\)/);
assert.match(source, /node\.textContent = String\(textValue\)/);
assert.match(source, /make\(doc, 'article'/, 'history rows are real list items');
assert.match(source, /setAttribute\('role', 'listitem'\)/);
assert.match(source, /list\.setAttribute\('role', 'list'\)/);
assert.match(source, /make\(doc, 'button'/);
assert.match(source, /aria-label/);
assert.match(source, /aria-expanded/);
assert.match(source, /aria-controls/);
assert.doesNotMatch(source, /innerHTML/);
assert.doesNotMatch(source, /outerHTML/);
assert.doesNotMatch(source, /insertAdjacentHTML/);
assert.doesNotMatch(source, /document\.write/);
console.log('composer history DOM boundary: ok');
