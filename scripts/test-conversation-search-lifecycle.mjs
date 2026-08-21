import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const api = require('../public/conversation-search.js');

class El {
  constructor(tag='div'){ this.tagName=tag.toUpperCase(); this.children=[]; this.parentNode=null; this.listeners=new Map(); this.attributes=new Map(); this.dataset={}; this.hidden=false; this.disabled=false; this.value=''; this.id=''; this.className=''; this.textContent=''; }
  append(...nodes){ for(const n of nodes){ n.parentNode=this; this.children.push(n); } }
  insertBefore(node,before){ node.parentNode=this; const i=this.children.indexOf(before); if(i<0)this.children.push(node); else this.children.splice(i,0,node); }
  remove(){ if(!this.parentNode)return; this.parentNode.children=this.parentNode.children.filter(x=>x!==this); this.parentNode=null; }
  setAttribute(k,v){ this.attributes.set(k,String(v)); }
  addEventListener(t,fn){ if(!this.listeners.has(t))this.listeners.set(t,[]); this.listeners.get(t).push(fn); }
  removeEventListener(t,fn){ this.listeners.set(t,(this.listeners.get(t)||[]).filter(x=>x!==fn)); }
  focus(){ this.focused=true; }
  matches(sel){ if(sel.startsWith('#'))return this.id===sel.slice(1); if(sel.startsWith('.'))return this.className.split(/\s+/).includes(sel.slice(1)); return false; }
  querySelector(sel){ return this.querySelectorAll(sel)[0]||null; }
  querySelectorAll(sel){ const out=[]; for(const c of this.children){ if(c.matches(sel))out.push(c); out.push(...c.querySelectorAll(sel)); } return out; }
}

function fixture(){
  const head=new El('head'); const body=new El('body'); const history=new El('section'); history.className='history-block';
  const list=new El('div'); list.id='conversationList'; history.append(list); body.append(history);
  const rowA=new El('div'); rowA.className='conversation-row'; rowA.dataset.conversationId='a'; const aBtn=new El('button'); aBtn.className='conversation-open'; aBtn.textContent='Ankara'; rowA.append(aBtn);
  const rowB=new El('div'); rowB.className='conversation-row'; rowB.dataset.conversationId='b'; rowB.hidden=true; const bBtn=new El('button'); bBtn.className='conversation-open'; bBtn.textContent='Bursa'; rowB.append(bBtn); list.append(rowA,rowB);
  const doc={ head, body, createElement:t=>new El(t), querySelector(sel){ if(sel==='.history-block')return history; if(sel==='#conversationList')return list; if(sel==='#'+api.STYLE_ID)return head.querySelector(sel); return body.querySelector(sel)||head.querySelector(sel); } };
  const rootListeners=new Map(); const raf=new Map(); let next=1;
  const root={
    localStorage:{ getItem(){ return JSON.stringify([{id:'a',title:'Ankara',messages:[{role:'user',content:'metro'}]},{id:'b',title:'Bursa',messages:[]}]); } },
    HafizeConversationStorageGuard:{ STORAGE_KEY:'hafize.conversations.v1', sanitizeStoredValue(raw){ return {value:JSON.parse(raw)}; } },
    addEventListener(t,fn){ if(!rootListeners.has(t))rootListeners.set(t,[]); rootListeners.get(t).push(fn); },
    removeEventListener(t,fn){ rootListeners.set(t,(rootListeners.get(t)||[]).filter(x=>x!==fn)); },
    requestAnimationFrame(fn){ const id=next++; raf.set(id,fn); return id; },
    cancelAnimationFrame(id){ raf.delete(id); }
  };
  class MO { constructor(fn){ this.fn=fn; MO.instances.push(this); } observe(){ this.active=true; } disconnect(){ this.active=false; } } MO.instances=[];
  return {doc,root,list,rowA,rowB,history,raf,rootListeners,MO};
}

{
  const f=fixture();
  const first=api.createController({documentRef:f.doc,rootRef:f.root,MutationObserverImpl:f.MO});
  const second=api.createController({documentRef:f.doc,rootRef:f.root,MutationObserverImpl:f.MO});
  assert.equal(first.mount(),true);
  assert.equal(second.mount(),false,'duplicate list ownership fails closed');
  const input=f.doc.querySelector('#'+api.INPUT_ID); input.value='ankara'; first.apply();
  assert.equal(f.rowA.hidden,false); assert.equal(f.rowB.hidden,true);
  input.value='metro'; first.apply(); assert.equal(f.rowA.hidden,false); assert.equal(f.rowB.hidden,true);
  input.value='none'; first.apply(); assert.equal(f.rowA.hidden,true); assert.equal(f.rowB.hidden,true);
  assert.equal(first.queueRefresh(),true); assert.equal(f.raf.size,1);
  const stale=[...f.raf.values()][0];
  assert.equal(first.destroy(),true); assert.equal(first.destroy(),false);
  assert.equal(f.rowA.hidden,false,'row A original hidden restored');
  assert.equal(f.rowB.hidden,true,'row B original hidden restored');
  assert.equal(f.doc.querySelector('#'+api.CONTROL_ID),null);
  assert.equal(f.doc.querySelector('#'+api.STYLE_ID),null);
  assert.equal(f.raf.size,0,'pending RAF cancelled');
  stale();
  assert.equal(f.rowA.hidden,false); assert.equal(f.rowB.hidden,true,'stale RAF inert after destroy');
  assert.equal(second.mount(),true,'ownership released for clean remount'); second.destroy();
}

{
  const f=fixture();
  const c=api.createController({documentRef:f.doc,rootRef:f.root,MutationObserverImpl:f.MO}); c.mount();
  const input=f.doc.querySelector('#'+api.INPUT_ID); input.value='none'; c.apply();
  assert.equal(f.rowA.hidden,true);
  const storage=(f.rootListeners.get('storage')||[])[0]; storage({key:'other'}); assert.equal(f.raf.size,0);
  storage({key:'hafize.conversations.v1'}); assert.equal(f.raf.size,1);
  const callback=[...f.raf.values()][0]; f.raf.clear(); callback();
  assert.equal(c.getState().pendingRefresh,false);
  c.destroy();
}

console.log('conversation search lifecycle tests passed');
