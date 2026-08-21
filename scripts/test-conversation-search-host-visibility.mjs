import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url); const api=require('../public/conversation-search.js');

class E{constructor(){this.children=[];this.parentNode=null;this.listeners=new Map();this.hidden=false;this.id='';this.className='';this.dataset={};this.value='';this.textContent='';}append(...n){for(const x of n){x.parentNode=this;this.children.push(x)}}insertBefore(n,b){n.parentNode=this;const i=this.children.indexOf(b);i<0?this.children.push(n):this.children.splice(i,0,n)}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this)}setAttribute(){}addEventListener(t,f){if(!this.listeners.has(t))this.listeners.set(t,[]);this.listeners.get(t).push(f)}removeEventListener(t,f){this.listeners.set(t,(this.listeners.get(t)||[]).filter(x=>x!==f))}matches(s){return s[0]==='#'?this.id===s.slice(1):s[0]==='.'?this.className.split(/\s+/).includes(s.slice(1)):false}querySelector(s){return this.querySelectorAll(s)[0]||null}querySelectorAll(s){const o=[];for(const c of this.children){if(c.matches(s))o.push(c);o.push(...c.querySelectorAll(s))}return o}focus(){}}
function make(){const head=new E(),body=new E(),history=new E(),list=new E();history.className='history-block';list.id='conversationList';history.append(list);body.append(history);const visible=new E(),hidden=new E();visible.className=hidden.className='conversation-row';visible.dataset.conversationId='v';hidden.dataset.conversationId='h';hidden.hidden=true;for(const [row,title] of [[visible,'Visible'],[hidden,'Hidden']]){const b=new E();b.className='conversation-open';b.textContent=title;row.append(b);list.append(row)}const doc={head,body,createElement(){return new E()},querySelector(s){if(s==='.history-block')return history;if(s==='#conversationList')return list;return body.querySelector(s)||head.querySelector(s)}};const root={localStorage:{getItem(){return'[]'}},HafizeConversationStorageGuard:{sanitizeStoredValue(){return{value:[]}}},addEventListener(){},removeEventListener(){}};return{doc,root,list,visible,hidden}}
{
 const f=make(); const c=api.createController({documentRef:f.doc,rootRef:f.root,MutationObserverImpl:null}); assert.equal(c.mount(),true);
 const input=f.doc.querySelector('#'+api.INPUT_ID);
 assert.equal(f.visible.hidden,false);
 assert.equal(f.hidden.hidden,true,'mount with empty query does not unhide host-hidden row');
 input.value='hidden'; c.apply();
 assert.equal(f.visible.hidden,true);
 assert.equal(f.hidden.hidden,true,'matching search cannot widen host visibility');
 input.value=''; c.apply();
 assert.equal(f.visible.hidden,false);
 assert.equal(f.hidden.hidden,true,'clear restores search-owned filtering without widening host state');
 input.value='x'.repeat(api.MAX_QUERY_CHARS+1); const invalid=c.apply();
 assert.equal(invalid.ok,false);
 assert.equal(f.visible.hidden,false);
 assert.equal(f.hidden.hidden,true,'invalid query fails open only within host-visible set');
 c.destroy();
 assert.equal(f.visible.hidden,false);
 assert.equal(f.hidden.hidden,true);
}
console.log('conversation search host visibility tests passed');
