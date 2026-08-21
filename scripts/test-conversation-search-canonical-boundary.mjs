import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url); const api=require('../public/conversation-search.js');

{
  const conversations=[];
  for(let i=0;i<api.MAX_INDEXED_CONVERSATIONS+5;i++) conversations.push({id:`c${i}`,title:`Title ${i}`,messages:[{role:'user',content:`Body ${i}`}]});
  const index=api.buildCanonicalIndex(conversations);
  assert.equal(index.size,api.MAX_INDEXED_CONVERSATIONS);
  assert.equal(index.has('c0'),true);
  assert.equal(index.has(`c${api.MAX_INDEXED_CONVERSATIONS-1}`),true);
  assert.equal(index.has(`c${api.MAX_INDEXED_CONVERSATIONS}`),false);
}
{
  const huge='x'.repeat(api.MAX_INDEXED_CONVERSATION_CHARS+5000);
  const index=api.buildCanonicalIndex([{id:'one',title:'T',messages:[{role:'user',content:huge}]}]);
  assert.ok(index.get('one').length<=api.MAX_INDEXED_CONVERSATION_CHARS);
}
{
  const conversations=[];
  for(let i=0;i<api.MAX_INDEXED_CONVERSATIONS;i++) conversations.push({id:`z${i}`,title:'',messages:[{role:'assistant',content:'y'.repeat(api.MAX_INDEXED_CONVERSATION_CHARS)}]});
  const index=api.buildCanonicalIndex(conversations);
  const total=[...index.values()].reduce((sum,value)=>sum+value.length,0);
  assert.ok(total<=api.MAX_INDEXED_TOTAL_CHARS);
}
{
  const index=api.buildCanonicalIndex([
    {id:'dup',title:'first',messages:[]},
    {id:'dup',title:'second',messages:[]},
    {id:'bad id',title:'bad',messages:[]},
    {id:'good',title:'ok',messages:[{role:'system',content:'system secret'},{role:'tool',content:'tool secret'},{role:'assistant',content:'visible answer'}]}
  ]);
  assert.equal(index.size,2);
  assert.equal(index.get('dup'),'first');
  assert.equal(index.has('bad id'),false);
  assert.match(index.get('good'),/visible answer/);
  assert.equal(index.get('good').includes('system secret'),false);
  assert.equal(index.get('good').includes('tool secret'),false);
}
{
  let calls=0;
  const unavailable=api.readCanonicalIndex({localStorage:{getItem(){calls++;return'[]'}}});
  assert.equal(unavailable.ready,false);
  assert.equal(calls,0,'storage is not read without guard');
}
{
  let calls=0;
  const failed=api.readCanonicalIndex({
    HafizeConversationStorageGuard:{STORAGE_KEY:'safe',sanitizeStoredValue(){throw new Error('invalid canonical data')}},
    localStorage:{getItem(key){calls++;assert.equal(key,'safe');return'bad';}}
  });
  assert.equal(calls,1);
  assert.equal(failed.ready,false);
  assert.equal(failed.index.size,0);
}
{
  const row={dataset:{conversationId:'abc'},querySelector(){return{textContent:'Başlık'}}};
  const content=new Map([['abc','mesaj gövdesi']]);
  assert.equal(api.rowMatches(row,'başlık',content),true);
  assert.equal(api.rowMatches(row,'mesaj',content),true);
  assert.equal(api.rowMatches(row,'yok',content),false);
}
{
  assert.equal(api.rowConversationId({dataset:{conversationId:'safe.id:1'}}),'safe.id:1');
  assert.equal(api.rowConversationId({dataset:{conversationId:'bad/id'}}),'');
  assert.equal(api.rowConversationId({dataset:{conversationId:'x'.repeat(121)}}),'');
}
console.log('conversation search canonical boundary tests passed');
