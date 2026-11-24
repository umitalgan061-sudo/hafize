import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as policy from '../public/sw-policy.ts';

const source=readFileSync(new URL('../public/sw.ts',import.meta.url),'utf8').replace(/^import .* from '\.\/sw-policy\.ts';\s*$/m,'');
const origin='https://hafize.example';
const handlers=new Map(),deleted=[],stored=[];
let precached=[],skip=false,claimed=false,calls=0;
let network=async()=>({ok:true,source:'network',clone(){return this}});
const pathOf=input=>typeof input==='string'?input:new URL(input.url).pathname;
const cache={
 async addAll(items){precached=items.map(pathOf)},
 async match(input){const path=pathOf(input);return ['/index.html','/offline.html','/hero-donus.bin'].includes(path)?{source:'cached:'+path}:null},
 async put(request,response){stored.push([pathOf(request),response.source])}
};
vm.runInNewContext(source,{
 ...policy,URL,Request,Response:{error:()=>({source:'error'})},
 caches:{open:async name=>{assert.equal(name,policy.CURRENT_CACHE);return cache},keys:async()=>['hafize-shell-v175',policy.CURRENT_CACHE,'other-app'],delete:async name=>{deleted.push(name);return true}},
 fetch:async(request,options)=>{calls++;assert.equal(options.cache,'no-store');return network(request)},
 self:{location:{origin},addEventListener:(name,fn)=>handlers.set(name,fn),skipWaiting:()=>{skip=true},clients:{claim:()=>{claimed=true}}}
});
async function lifecycle(name){let result;handlers.get(name)({waitUntil:p=>{result=p}});await result}
await lifecycle('install');assert.deepEqual(precached,[...policy.SHELL_ASSETS]);assert.equal(skip,true);
await lifecycle('activate');assert.deepEqual(deleted,['hafize-shell-v175']);assert.equal(claimed,true);
function dispatch(path,options={}){
 let result=null;
 handlers.get('fetch')({request:{url:new URL(path,origin).href,method:'GET',mode:'same-origin',headers:{},...options},respondWith:p=>{result=p}});
 return result;
}
assert.equal((await dispatch('/chat',{mode:'navigate'})).source,'network');
assert.equal((await dispatch('/hero-donus.bin')).source,'network');
assert.deepEqual(stored,[['/hero-donus.bin','network']]);
network=async()=>{throw Error('offline')};
assert.equal((await dispatch('/chat',{mode:'navigate'})).source,'cached:/index.html');
assert.equal((await dispatch('/hero-donus.bin?release=new')).source,'cached:/hero-donus.bin');
const before=calls;
assert.equal(dispatch('/api/models'),null);
assert.equal(dispatch('/release.json'),null);
assert.equal(dispatch('/hero-donus.bin',{headers:{range:'bytes=0-10'}}),null);
assert.equal(dispatch('/media/hafize-point-portrait-alpha.webm'),null);
assert.equal(calls,before);
console.log('PWA service worker runtime OK: network first, offline fallback, scoped activation and single portrait assets');
