import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const api = require('../public/hands-free-consent.js');

function element(id = '') {
  const attrs = new Map(); const listeners = { capture: [], bubble: [] }; const children = [];
  return { id, hidden: false, disabled: false, parentNode: null, children, textContent: '', className: '',
    setAttribute(k,v){attrs.set(k,String(v));}, getAttribute(k){return attrs.get(k)??null;}, removeAttribute(k){attrs.delete(k);},
    append(...nodes){nodes.forEach(n=>{n.parentNode=this;children.push(n);});}, insertAdjacentElement(_p,node){node.parentNode=this.parentNode;this.parentNode.children.push(node);},
    addEventListener(type,fn,capture){if(type==='click')listeners[capture?'capture':'bubble'].push(fn);}, removeEventListener(){}, focus(){}, remove(){},
    click(){const event={preventDefault(){},stopImmediatePropagation(){this.stopped=true;}};for(const fn of listeners.capture){fn(event);if(event.stopped)return;}for(const fn of listeners.bubble)fn(event);}
  };
}

const toggle=element('handsFreeToggle'); toggle.setAttribute('aria-pressed','false');
const indicator=element('handsFreeIndicator'); const card=element('voice-card'); card.append(toggle,indicator);
const docListeners=new Map();
const doc={hidden:false,querySelector(s){return s==='#handsFreeToggle'?toggle:s==='#handsFreeIndicator'?indicator:null;},getElementById(){return null;},createElement(){return element();},addEventListener(t,fn){const list=docListeners.get(t)||[];list.push(fn);docListeners.set(t,list);},removeEventListener(){}};
const timers=new Map(); let id=0; const root={setTimeout(fn,ms){const n=++id;timers.set(n,{fn,ms});return n;},clearTimeout(n){timers.delete(n);}};

let starts=0; let stops=0;
toggle.addEventListener('click',()=>{const next=toggle.getAttribute('aria-pressed')!=='true';toggle.setAttribute('aria-pressed',String(next));if(next)starts+=1;else stops+=1;});
const consent=api.installHandsFreeConsent(doc,root);

toggle.click();
assert.equal(starts,0,'first user click must not activate continuous listening');
assert.equal(toggle.getAttribute('aria-pressed'),'false');
assert.equal(consent.isPending(),true);

const review=card.children.at(-1); const confirm=review.children[2].children[0];
confirm.click();
assert.equal(starts,1,'explicit confirm activates existing hands-free runtime exactly once');
assert.equal(toggle.getAttribute('aria-pressed'),'true');
assert.equal(consent.isPending(),false);

toggle.click();
assert.equal(stops,1,'already-active microphone remains one-click to disable');
assert.equal(toggle.getAttribute('aria-pressed'),'false');
assert.equal(consent.isPending(),false);

toggle.click();
assert.equal(starts,1,'consent is not sticky across enable attempts');
assert.equal(consent.isPending(),true);
console.log('hands-free consent integration tests passed');
