import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../public/response-retry.css', import.meta.url), 'utf8');
const styleLoader = await readFile(new URL('../public/response-retry-style.js', import.meta.url), 'utf8');

assert.match(css, /\.response-retry-action\s*\{/);
assert.match(css, /\.response-retry-button\s*\{/);
assert.match(css, /min-height:\s*34px/);
assert.match(css, /@media\s*\(max-width:\s*680px\)/);
assert.match(css, /min-height:\s*40px/);
assert.match(css, /:focus-visible/);
assert.match(css, /outline-offset:\s*2px/);
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
assert.match(css, /transform:\s*none/);
assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
assert.match(css, /ButtonText/);

assert.match(styleLoader, /documentRef\.head/);
assert.match(styleLoader, /link\[data-hafize-response-retry-style\]/);
assert.match(styleLoader, /link\.rel = 'stylesheet'/);
assert.match(styleLoader, /link\.href = '\/response-retry\.css'/);
assert.match(styleLoader, /data-hafize-response-retry-style/);
assert.doesNotMatch(styleLoader, /fetch\s*\(/);
assert.doesNotMatch(styleLoader, /localStorage|sessionStorage|document\.cookie/);

console.log('response retry style tests passed');
