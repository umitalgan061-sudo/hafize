import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const search = require('../public/conversation-search.js');

function row(title,id='') {
  return { hidden:false, dataset:{conversationId:id}, querySelector(s){ return s==='.conversation-open'?{textContent:title}:null; } };
}

assert.equal(search.MAX_QUERY_CHARS,120);
assert.equal(search.MAX_INDEXED_CONVERSATIONS,30);
assert.equal(search.normalizeQuery('  Ankara   Planı  '),'ankara planı');
assert.equal(search.normalizeQuery('İSTANBUL'),'istanbul');
assert.equal(search.normalizeQuery('x'.repeat(121)),null);

const index=search.buildCanonicalIndex([
  {id:'a',title:'Ankara',messages:[{role:'user',content:'Metro planı'},{role:'tool',content:'secret tool text'}]},
  {id:'b',title:'Bursa',messages:[{role:'assistant',content:'Kestane önerisi'}]}
]);
assert.match(index.get('a'),/metro planı/);
assert.equal(index.get('a').includes('secret tool text'),false,'tool content excluded from canonical search index');
const rows=[row('Ankara','a'),row('Bursa','b'),row('Gmail','c')];
assert.equal(search.filterRows(rows,'kestane',index).visible,1);
assert.deepEqual(rows.map(r=>r.hidden),[true,false,true]);
assert.equal(search.filterRows(rows,'',index).visible,3);
assert.deepEqual(rows.map(r=>r.hidden),[false,false,false]);
assert.deepEqual(search.filterRows(rows,'x'.repeat(121),index),{ok:false,total:3,visible:3,query:''});

let requestedKey=null;
const canonical=search.readCanonicalIndex({
  HafizeConversationStorageGuard:{STORAGE_KEY:'guarded.key',sanitizeStoredValue(raw){assert.equal(raw,'stored');return{value:[{id:'x',title:'T',messages:[{role:'user',content:'guarded body'}]}]};}},
  localStorage:{getItem(key){requestedKey=key;return'stored';}}
});
assert.equal(requestedKey,'guarded.key');
assert.equal(canonical.ready,true);
assert.match(canonical.index.get('x'),/guarded body/);
assert.equal(search.readCanonicalIndex({}).ready,false);

const sourcePath=fileURLToPath(new URL('../public/conversation-search.js',import.meta.url));
const source=await readFile(sourcePath,'utf8');
const syntax=spawnSync(process.execPath,['--check',sourcePath],{encoding:'utf8'});
assert.equal(syntax.status,0,syntax.stderr||syntax.stdout);
for(const forbidden of [/\bsessionStorage\b/,/document\.cookie/,/\bfetch\s*\(/,/\bWebSocket\b/,/navigator\.clipboard/,/data-message-id/,/Authorization/i,/HAFIZE_.*(?:TOKEN|KEY|SECRET)/]) {
  assert.equal(forbidden.test(source),false,`forbidden surface: ${forbidden}`);
}
assert.equal(source.includes('HafizeConversationStorageGuard'),true,'canonical storage must pass through storage guard');
assert.equal(source.includes("message?.role !== 'user' && message?.role !== 'assistant'"),true,'only user/assistant bodies are indexed');
assert.equal(source.includes('ACTIVE_LISTS = new WeakSet()'),true,'duplicate controller ownership is explicit');
assert.equal(source.includes('restoreRows()'),true,'teardown restores row visibility');
assert.equal(source.includes("observer.observe(list, { childList: true, subtree: true })"),true);
assert.equal(source.includes("event?.key !== 'Escape'"),true);
assert.equal(source.includes("field.setAttribute('aria-controls', 'conversationList')"),true);

console.log('conversation search security tests passed');
