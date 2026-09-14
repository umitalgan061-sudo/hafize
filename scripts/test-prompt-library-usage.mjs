import assert from 'node:assert/strict';
import fs from 'node:fs';

const usage = fs.readFileSync('public/prompt-library-usage.js', 'utf8');
const css = fs.readFileSync('public/prompt-library.css', 'utf8');

assert.match(usage, /hafize\.prompt-library\.v1/);
assert.match(usage, /Kullanım istatistikleri/);
assert.match(usage, /Toplam kullanım/);
assert.match(usage, /En çok kullanılan/);
assert.match(usage, /Son kullanılan/);
assert.match(usage, /Number\.isFinite\(value\)/);
assert.match(usage, /Math\.floor\(value\)/);
assert.match(usage, /Math\.min\(9999/);
assert.match(usage, /textContent/);
assert.match(usage, /replaceChildren\(\)/);
assert.match(usage, /MutationObserver/);
assert.match(usage, /aria-expanded/);
assert.match(usage, /aria-labelledby/);
assert.doesNotMatch(usage, /innerHTML/);
assert.doesNotMatch(usage, /fetch\(/);
assert.doesNotMatch(usage, /XMLHttpRequest/);
assert.match(css, /prompt-library-usage-insights/);
assert.match(css, /prompt-library-usage-stats/);
assert.match(css, /prompt-library-usage-row/);
assert.match(css, /@media \(max-width:700px\)/);
assert.match(css, /forced-colors:active/);
console.log('prompt-library usage contracts: ok');
