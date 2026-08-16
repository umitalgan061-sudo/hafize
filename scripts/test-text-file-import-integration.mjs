import assert from 'node:assert/strict';
import fs from 'node:fs';

const controller = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const feature = fs.readFileSync(new URL('../public/text-file-import.js', import.meta.url), 'utf8');

assert.match(controller, /HafizeTextFileImport/);
assert.match(controller, /\/text-file-import\.js/);
assert.match(controller, /data-hafize-text-file-import/);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v42`/);
assert.match(sw, /'\/text-file-import\.js'/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);
assert.match(feature, /stopImmediatePropagation/);
assert.match(feature, /Göndermek için sen onaylamalısın/);
assert.ok(!feature.includes('fetch('));
assert.ok(!feature.includes('requestSubmit'));
assert.ok(!feature.includes('localStorage'));
assert.ok(!feature.includes('sessionStorage'));
assert.ok(!feature.includes('navigator.clipboard'));

console.log('text file import integration ok');
