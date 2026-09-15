import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../public/message-outline.js', import.meta.url), 'utf8');
assert.ok(file.includes('MIN_HEADINGS'));
assert.ok(file.includes('MAX_HEADINGS'));
assert.ok(file.includes('MAX_LABEL'));
assert.ok(file.includes("querySelectorAll('h1,h2,h3')"));
assert.ok(file.includes('Başlık özeti'));
assert.ok(file.includes('aria-expanded'));
assert.ok(file.includes("setAttribute('aria-label', 'Yanıt başlıkları')"));
assert.ok(file.includes('data-level'));
assert.ok(file.includes('MutationObserver'));
assert.ok(file.includes('scroll') === false);
assert.ok(!file.includes('fetch('));
assert.ok(!file.includes('innerHTML'));
console.log('assistant message outline contract ok');
