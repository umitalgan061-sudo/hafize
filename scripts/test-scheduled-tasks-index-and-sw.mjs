import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

const cssMatches = index.match(/<link rel="stylesheet" href="\/scheduled-tasks\.css"\s*\/>/g) || [];
const deferredScripts = index.match(/<script src="\/scheduled-tasks-[a-z-]+\.js" defer><\/script>/g) || [];
assert.equal(cssMatches.length, 1);
assert.match(index, /<script src="\/scheduled-tasks\.js" defer><\/script>/);
assert.match(index, /<script src="\/scheduled-tasks-enhancements\.js" defer><\/script>/);
assert.match(index, /<script src="\/scheduled-tasks-keyboard\.js" defer><\/script>/);
// Geri sayım modülü TypeScript'e taşındı: tarayıcı `.mts` yükleyemediği için
// sayfa vite çıktısını modül olarak yükler, `defer` betiği olarak değil.
assert.match(index, /<script type="module" src="\/typed-build\/scheduled-tasks-countdown\.js"><\/script>/);
assert.doesNotMatch(index, /src="\/scheduled-tasks-countdown\.js"/, 'ham kaynak ikinci kez yüklenmez');
// Geri sayım artık `typed-build/` altından modül olarak geldiği için bu
// desene yalnızca iki `defer` betiği uyar; sayı açıkça yazılır ki üçüncü
// bir betiğin sessizce eklenmesi ya da düşmesi fark edilsin.
assert.equal(deferredScripts.length, 2, `beklenen iki defer betiği: ${deferredScripts.join(', ')}`);
assert.match(sw, /\/scheduled-tasks\.css/);
assert.match(sw, /\/scheduled-tasks\.js/);
assert.match(sw, /\/scheduled-tasks-enhancements\.js/);
assert.match(sw, /\/scheduled-tasks-keyboard\.js/);
assert.match(sw, /\/typed-build\/scheduled-tasks-countdown\.js/);
assertVersionedCacheDeclaration(sw);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /network-only/);
console.log('scheduled task shell integration: ok');
