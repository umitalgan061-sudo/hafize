import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-write-readiness.js');

class Node {
  constructor() { this.children=[]; this.parentNode=null; this.attributes=new Map(); this.dataset={}; this.listeners=new Map(); this.className=''; this.textContent=''; this.hidden=false; this.disabled=false; this.id=''; }
  setAttribute(n,v){this.attributes.set(n,String(v));} getAttribute(n){return this.attributes.has(n)?this.attributes.get(n):null;} removeAttribute(n){this.attributes.delete(n);}
  append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}} remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter((n)=>n!==this);this.parentNode=null;}}
  addEventListener(n,f){if(!this.listeners.has(n))this.listeners.set(n,[]);this.listeners.get(n).push(f);} removeEventListener(n,f){this.listeners.set(n,(this.listeners.get(n)||[]).filter((x)=>x!==f));}
  matches(s){return s==='.utility-rail'?this.className==='utility-rail':s==='#githubWriteReadinessCard'?this.id==='githubWriteReadinessCard':s==='#githubWriteReadinessSummary'?this.id==='githubWriteReadinessSummary':s==='.github-write-readiness-summary'?this.className.includes('github-write-readiness-summary'):s==='.github-write-readiness-badge'?this.className.includes('github-write-readiness-badge'):s==='.github-write-readiness-refresh'?this.className.includes('github-write-readiness-refresh'):false;}
  find(s){if(this.matches(s))return this;for(const c of this.children){const f=c.find?.(s);if(f)return f;}return null;} querySelector(s){for(const c of this.children){const f=c.find?.(s);if(f)return f;}return null;}
}

function fixture(fetchImpl) {
  const rail = new Node(); rail.className='utility-rail';
  const doc = { createElement:()=>new Node(), querySelector:(s)=>rail.find(s) };
  const root = { AbortController, setTimeout, clearTimeout, fetch: fetchImpl };
  const controller = api.createController({ documentRef: doc, rootRef: root, fetchImpl });
  assert.equal(controller.mount(), true);
  return { rail, controller, card:()=>rail.find('#githubWriteReadinessCard') };
}

{
  const calls=[];
  const fetchImpl=(_url,options)=>new Promise((resolve,reject)=>{
    const call={resolve,reject,signal:options.signal}; calls.push(call);
    options.signal.addEventListener('abort',()=>{const e=new Error('aborted');e.name='AbortError';reject(e);},{once:true});
  });
  const f=fixture(fetchImpl);
  await Promise.resolve();
  assert.equal(calls.length,1);
  const second=f.controller.load();
  await Promise.resolve();
  assert.equal(calls.length,2);
  assert.equal(calls[0].signal.aborted,true,'new refresh aborts prior request');
  calls[1].resolve({ok:true,json:async()=>({githubWriteConfigured:false})});
  await second;
  const status=f.card().querySelector('.github-write-readiness-summary');
  const refresh=f.card().querySelector('.github-write-readiness-refresh');
  assert.equal(status.dataset.state,'off');
  assert.equal(refresh.disabled,false);
  assert.equal(f.controller.getState().loading,false);
  f.controller.destroy();
}

{
  let firstResolve, secondResolve;
  let count=0;
  const fetchImpl=async()=>{
    count+=1;
    if(count===1)return await new Promise((resolve)=>{firstResolve=resolve;});
    return await new Promise((resolve)=>{secondResolve=resolve;});
  };
  const f=fixture(fetchImpl);
  await Promise.resolve();
  const second=f.controller.load();
  await Promise.resolve();
  secondResolve({ok:true,json:async()=>({githubWriteConfigured:true})});
  await second;
  const status=f.card().querySelector('.github-write-readiness-summary');
  assert.equal(status.dataset.state,'ready');
  firstResolve({ok:true,json:async()=>({githubWriteConfigured:false})});
  await new Promise((resolve)=>setTimeout(resolve,0));
  assert.equal(status.dataset.state,'ready','late superseded completion cannot overwrite current state');
  f.controller.destroy();
}

{
  let resolveFetch;
  const f=fixture(async()=>await new Promise((resolve)=>{resolveFetch=resolve;}));
  await Promise.resolve();
  const card=f.card();
  const status=card.querySelector('.github-write-readiness-summary');
  assert.equal(f.controller.destroy(),true);
  resolveFetch({ok:true,json:async()=>({githubWriteConfigured:true})});
  await new Promise((resolve)=>setTimeout(resolve,0));
  assert.equal(f.card(),null,'destroyed controller does not recreate or mutate owned card after late completion');
  assert.equal(f.controller.getState().destroyed,true);
  assert.equal(await f.controller.load(),null,'destroyed controller is inert');
  assert.equal(f.controller.render({githubWriteConfigured:true}),false,'destroyed render is inert');
  assert.ok(status,'detached prior status existed only for stale-callback assertion');
}

{
  const f=fixture(async()=>({ok:true,json:async()=>({githubWriteConfigured:'yes'})}));
  await new Promise((resolve)=>setTimeout(resolve,0));
  const status=f.card().querySelector('.github-write-readiness-summary');
  const badge=f.card().querySelector('.github-write-readiness-badge');
  assert.equal(status.dataset.state,'error');
  assert.equal(badge.dataset.state,'unknown');
  assert.equal(f.card().getAttribute('aria-busy'),'false');
  f.controller.destroy();
}

console.log('GitHub write readiness race tests passed');
