import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url); const api=require('../public/conversation-search.js');

class El { constructor(tag='div'){this.tagName=tag;this.children=[];this.parentNode=null;this.listeners=new Map();this.attributes=new Map();this.dataset={};this.hidden=false;this.id='';this.className='';this.textContent='';this.value='';}
append(...ns){for(const n of ns){n.parentNode=this;this.children.push(n)}} insertBefore(n,b){n.parentNode=this;const i=this.children.indexOf(b);i<0?this.children.push(n):this.children.splice(i,0,n)} remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null}}
setAttribute(k,v){this.attributes.set(k,String(v))} addEventListener(t,f){if(!this.listeners.has(t))this.listeners.set(t,[]);this.listeners.get(t).push(f)} removeEventListener(t,f){this.listeners.set(t,(this.listeners.get(t)||[]).filter(x=>x!==f))}
matches(s){if(s[0]==='#')return this.id===s.slice(1);if(s[0]==='.')return this.className.split(/\s+/).includes(s.slice(1));return false} querySelector(s){return this.querySelectorAll(s)[0]||null} querySelectorAll(s){const o=[];for(const c of this.children){if(c.matches(s))o.push(c);o.push(...c.querySelectorAll(s))}return o} focus(){}
}
function make({failListener=false,failObserve=false,foreignControl=false,existingStyle=false}={}){
 const head=new El('head'),body=new El('body'),history=new El('div'),list=new El('div'); history.className='history-block';list.id='conversationList';history.append(list);body.append(history);
 const row=new El('div');row.className='conversation-row';const btn=new El('button');btn.className='conversation-open';btn.textContent='A';row.append(btn);list.append(row);
 if(existingStyle){const s=new El('style');s.id=api.STYLE_ID;head.append(s)}
 if(foreignControl){const c=new El('div');c.id=api.CONTROL_ID;history.insertBefore(c,list)}
 const doc={head,body,createElement(t){const e=new El(t);if(failListener&&t==='button'){e.addEventListener=()=>{throw new Error('listener fail')}}return e},querySelector(s){if(s==='.history-block')return history;if(s==='#conversationList')return list;return body.querySelector(s)||head.querySelector(s)}};
 const root={addEventListener(){},removeEventListener(){},requestAnimationFrame(){return 1},cancelAnimationFrame(){},localStorage:{getItem(){return'[]'}},HafizeConversationStorageGuard:{sanitizeStoredValue(){return{value:[]}}}};
 class MO{constructor(fn){this.fn=fn}observe(){if(failObserve)throw new Error('observe fail');this.active=true}disconnect(){this.active=false}}
 return{head,history,list,row,doc,root,MO};
}

{
 const f=make({foreignControl:true}); const c=api.createController({documentRef:f.doc,rootRef:f.root,MutationObserverImpl:f.MO});
 assert.equal(c.mount(),false,'foreign control blocks mount'); assert.ok(f.doc.querySelector('#'+api.CONTROL_ID),'foreign control preserved');
 assert.equal(f.doc.querySelector('#'+api.STYLE_ID),null,'owned style rolled back'); assert.equal(c.getState().mounted,false);
}
{
 const f=make({failListener:true}); const c=api.createController({documentRef:f.doc,rootRef:f.root,MutationObserverImpl:f.MO});
 assert.equal(c.mount(),false); assert.equal(f.doc.querySelector('#'+api.CONTROL_ID),null); assert.equal(f.doc.querySelector('#'+api.STYLE_ID),null); assert.equal(f.row.hidden,false);
}
{
 const f=make({failObserve:true,existingStyle:true}); const style=f.doc.querySelector('#'+api.STYLE_ID); const c=api.createController({documentRef:f.doc,rootRef:f.root,MutationObserverImpl:f.MO});
 assert.equal(c.mount(),false,'observer failure rolls installation back'); assert.equal(f.doc.querySelector('#'+api.CONTROL_ID),null); assert.equal(f.doc.querySelector('#'+api.STYLE_ID),style,'host style preserved');
 assert.equal(f.row.hidden,false,'row state restored after failed observer install');
}
{
 const f=make(); const c=api.createController({documentRef:f.doc,rootRef:{...f.root,requestAnimationFrame(){throw new Error('raf unavailable')}},MutationObserverImpl:f.MO});
 assert.equal(c.mount(),true); assert.equal(c.queueRefresh(),false,'scheduler failure is bounded'); assert.equal(c.getState().pendingRefresh,false); c.destroy();
}
console.log('conversation search installation fault tests passed');
