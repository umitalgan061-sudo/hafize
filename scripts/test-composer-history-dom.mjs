// DOM boundary for the composer history panel.
//
// The panel builds its nodes through a shared `make(doc, tag, …)` helper, so the
// old `createElement('article'` grep asserted a spelling the helper removed
// rather than the structure it produces. The contract here is the structure: a
// history row is an <article>, actions are real <button>s, every node is filled
// through textContent and nothing reaches an HTML sink.

import assert from 'node:assert/strict';
import fs from 'node:fs';


const source = fs.readFileSync('public/composer-history-panel.js', 'utf8');

const elementBuilt = (tag) =>
  source.includes(`createElement('${tag}')`)
  || source.includes(`createElement("${tag}")`)
  || new RegExp(`make\\(\\s*doc\\s*,\\s*'${tag}'`).test(source)
  || new RegExp(`make\\(\\s*documentRef\\s*,\\s*'${tag}'`).test(source);

// Rows and controls are built as real elements.
for (const tag of ['article', 'button', 'section']) {
  assert.ok(elementBuilt(tag), `panel builds a <${tag}> element`);
}
assert.match(source, /createElement\(/, 'the panel builds its DOM with the element API');

// Text always goes in as text.
assert.match(source, /textContent/);
assert.doesNotMatch(source, /innerHTML/);
assert.doesNotMatch(source, /outerHTML/);
assert.doesNotMatch(source, /insertAdjacentHTML/);

// The list and its destructive control stay announceable.
assert.match(source, /aria-label/, 'panel sets an accessible name on its controls');
assert.ok(
  /role',\s*'listitem'/.test(source) || source.includes('role="listitem"'),
  'history rows are exposed as list items'
);

console.log('composer history DOM boundary: ok');
