import assert from 'node:assert/strict';
import fs from 'node:fs';

const controller = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const feature = fs.readFileSync(new URL('../public/composer-paste-guard.js', import.meta.url), 'utf8');

assert.match(controller, /HafizeComposerPasteGuard/);
assert.match(controller, /\/composer-paste-guard\.js/);
assert.match(controller, /data-hafize-composer-paste-guard/);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(sw, /'\/composer-paste-guard\.js'/);
assert.match(sw, /'\/text-file-import\.js'/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);
assert.match(feature, /clipboardData/);
assert.ok(!feature.includes('navigator.clipboard'));
assert.ok(!feature.includes('requestSubmit'));

console.log('composer paste guard integration ok');
