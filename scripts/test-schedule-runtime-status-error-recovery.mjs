import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-runtime-status.js');

class E {
  constructor() { this.id=''; this.className=''; this.textContent=''; this.dataset={}; this.attributes=new Map(); this.children=[]; this.parentNode=null; this.disabled=false; this.listeners=new Map(); }
  append(...nodes){ for(const n of nodes){ n.parentNode=this; this.children.push(n); } }
  setAttribute(n,v){ this.attributes.set(n,String(v)); }
  getAttribute(n){ return this.attributes.has(n)?this.attributes.get(n):null; }
  removeAttribute(n){ this.attributes.delete(n); }
  addEventListener(n,f){ if(!this.listeners.has(n))this.listeners.set(n,[]); this.listeners.get(n).push(f); }
  removeEventListener(n,f){ this.listeners.set(n,(this.listeners.get(n)||[]).filter(x=>x!==f)); }
  remove(){ if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this); this.parentNode=null; }
  matches(s){ if(s.startsWith('#'))return this.id===s.slice(1); if(s.startsWith('.'))return this.className.split(/\s+/).includes(s.slice(1)); const k=s.match(/^\[data-key="(.+)"\]$/)?.[1]; return k?this.dataset.key===k:false; }
  querySelector(s){ for(const c of this.children){ if(c.matches(s))return c; const n=c.querySelector(s); if(n)return n; } return null; }
}

const rail=new E(); rail.className='utility-rail';
const card=new E(); card.id=api.CARD_ID;
const status=new E(); status.className='schedule-runtime-summary';
const refresh=new E(); refresh.className='schedule-runtime-refresh';
card.append(status,refresh);
const rows=[];
for(const [key] of api.FIELDS){ const row=new E(); row.dataset.key=key; rows.push(row); card.append(row); }
rail.append(card);
const documentRef={ createElement:()=>new E(), querySelector(s){ if(s==='.utility-rail')return rail; if(s===`#${api.CARD_ID}`)return card; return rail.querySelector(s); } };
const healthy={scheduleWorkerConfigured:true,scheduleApiConfigured:true,scheduleStorageDurable:true,scheduleLeaseConfigured:true};
let calls=0;
const controller=api.createController({ documentRef, fetchImpl:async()=>{ calls+=1; if(calls===1)return {ok:true,json:async()=>({bad:true})}; return {ok:true,json:async()=>healthy}; } });
assert.equal(controller.mount(),true);
await new Promise(r=>setTimeout(r,0));
assert.equal(status.dataset.state,'error');
assert.equal(status.textContent,'Görev motoru durumu alınamadı.');
assert.equal(refresh.disabled,false,'failed load releases refresh control');
for(const row of rows){ assert.equal(row.textContent,'—'); assert.equal(row.dataset.state,'unknown'); }
assert.deepEqual(await controller.load(),healthy);
assert.equal(status.dataset.state,'ready');
assert.equal(status.textContent,'Bulut görev motoru hazır.');
assert.equal(refresh.disabled,false);
for(const row of rows) assert.equal(row.dataset.state,'ready');
controller.destroy();
console.log('schedule runtime status error recovery tests passed');
