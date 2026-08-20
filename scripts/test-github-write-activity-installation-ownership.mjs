import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-write-activity.js');

class FakeNode {
  constructor() { this.children=[]; this.parentNode=null; this.attributes=new Map(); this.dataset={}; this.listeners=new Map(); this.className=''; this.textContent=''; this.hidden=false; this.disabled=false; this.id=''; }
  setAttribute(n,v){this.attributes.set(n,String(v));} getAttribute(n){return this.attributes.has(n)?this.attributes.get(n):null;}
  append(...nodes){for(const node of nodes){node.parentNode=this;this.children.push(node);}} replaceChildren(...nodes){this.children=[];this.append(...nodes);} remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter((n)=>n!==this);this.parentNode=null;}}
  addEventListener(n,f){if(!this.listeners.has(n))this.listeners.set(n,[]);this.listeners.get(n).push(f);} removeEventListener(n,f){this.listeners.set(n,(this.listeners.get(n)||[]).filter((x)=>x!==f));} listenerCount(n){return (this.listeners.get(n)||[]).length;}
  matches(s){if(s==='#githubWriteReadinessCard')return this.id==='githubWriteReadinessCard';if(s==='[data-github-write-activity]')return this.getAttribute('data-github-write-activity')!==null;return false;}
  find(s){if(this.matches(s))return this;for(const c of this.children){const f=c.find?.(s);if(f)return f;}return null;} querySelector(s){for(const c of this.children){const f=c.find?.(s);if(f)return f;}return null;}
  focus(){}
}

function fixture({ failRootEventAt = 0, observerError = false } = {}) {
  const body=new FakeNode(); const host=new FakeNode(); host.id='githubWriteReadinessCard'; body.append(host);
  const docListeners=new Map();
  const doc={body,createElement:()=>new FakeNode(),querySelector:(s)=>body.find(s),addEventListener(n,f){if(!docListeners.has(n))docListeners.set(n,[]);docListeners.get(n).push(f);},removeEventListener(n,f){docListeners.set(n,(docListeners.get(n)||[]).filter((x)=>x!==f));}};
  const rootListeners=new Map(); let addCount=0; let clearCount=0;
  class Observer { constructor(cb){this.cb=cb;this.disconnected=false;} observe(){if(observerError)throw new Error('observer failed');} disconnect(){this.disconnected=true;} }
  const root={MutationObserver:Observer,setTimeout(){return 55;},clearTimeout(id){assert.equal(id,55);clearCount+=1;},addEventListener(n,f){addCount+=1;if(failRootEventAt&&addCount===failRootEventAt)throw new Error('root event failed');if(!rootListeners.has(n))rootListeners.set(n,[]);rootListeners.get(n).push(f);},removeEventListener(n,f){rootListeners.set(n,(rootListeners.get(n)||[]).filter((x)=>x!==f));}};
  return {body,host,doc,root,docListeners,rootListeners,get clearCount(){return clearCount;}};
}

{
  const f=fixture();
  const controller=api.createController({documentRef:f.doc,rootRef:f.root,now:()=>1000});
  assert.equal(controller.mount(),true);
  const shell=f.host.querySelector('[data-github-write-activity]');
  assert.ok(shell,'controller-owned shell created');
  const duplicate=api.createController({documentRef:f.doc,rootRef:f.root,now:()=>1001});
  assert.equal(duplicate.mount(),false,'duplicate controller fails closed');
  for(const name of api.EVENT_NAMES)assert.equal((f.rootListeners.get(name)||[]).length,1);
  assert.equal(controller.destroy(),true);
  assert.equal(controller.destroy(),false,'destroy idempotent');
  assert.equal(f.host.querySelector('[data-github-write-activity]'),null,'owned shell removed');
  for(const name of api.EVENT_NAMES)assert.equal((f.rootListeners.get(name)||[]).length,0,'root listener removed');
  const retry=api.createController({documentRef:f.doc,rootRef:f.root,now:()=>1002});
  assert.equal(retry.mount(),true,'destroy releases host ownership');
  retry.destroy();
}

{
  const f=fixture({failRootEventAt:2});
  const controller=api.createController({documentRef:f.doc,rootRef:f.root});
  assert.equal(controller.mount(),false,'partial root listener failure rolls back');
  assert.equal(f.host.querySelector('[data-github-write-activity]'),null);
  for(const name of api.EVENT_NAMES)assert.equal((f.rootListeners.get(name)||[]).length,0);
  f.root.addEventListener=(n,fn)=>{if(!f.rootListeners.has(n))f.rootListeners.set(n,[]);f.rootListeners.get(n).push(fn);};
  const retry=api.createController({documentRef:f.doc,rootRef:f.root});
  assert.equal(retry.mount(),true,'failed install releases ownership');
  retry.destroy();
}

{
  const f=fixture();
  const hostShell=new FakeNode(); hostShell.setAttribute('data-github-write-activity','host'); f.host.append(hostShell);
  const controller=api.createController({documentRef:f.doc,rootRef:f.root});
  assert.equal(controller.mount(),false,'pre-existing host activity surface is not taken over');
  assert.equal(f.host.querySelector('[data-github-write-activity]'),hostShell);
  assert.equal(controller.destroy(),true);
  assert.equal(f.host.querySelector('[data-github-write-activity]'),hostShell,'host shell survives destroy');
}

{
  const f=fixture();
  const controller=api.createController({documentRef:f.doc,rootRef:f.root,now:()=>5000});
  assert.equal(controller.mount(),true);
  const handlers=f.rootListeners.get('hafize:github-branch-created');
  assert.equal(handlers.length,1);
  handlers[0]({type:'hafize:github-branch-created',detail:{branch:'hafize/test-branch'}});
  assert.deepEqual(controller.getItems(),[{kind:'branch',branch:'hafize/test-branch',at:5000}]);
  assert.equal(controller.clearItems(),true);
  assert.deepEqual(controller.getItems(),[]);
  controller.destroy();
  assert.equal(handlers[0]({type:'hafize:github-branch-created',detail:{branch:'hafize/late'}}),false,'stale event callback is inert');
  assert.deepEqual(controller.getItems(),[]);
  assert.equal(controller.clearItems(),false,'destroyed controller clear is inert');
}

{
  const f=fixture({observerError:true});
  f.body.children=[];
  const controller=api.createController({documentRef:f.doc,rootRef:f.root});
  assert.equal(controller.mount(),false,'observer setup fails closed');
  assert.equal(f.clearCount,0,'timer is not leaked when observe fails before timer creation');
  assert.equal(controller.destroy(),true);
}

console.log('GitHub write activity installation ownership tests passed');
