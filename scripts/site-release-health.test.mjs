import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {auditLocalBuild,referencedAssets} from './site-release-health.mjs';
test('only local asset paths, stripping cache query',()=>{
 assert.deepEqual(referencedAssets('<script src="/typed-build/app-shell.js?release=abc"></script><link href="https://x/a.css"><img src="//x/a"><img src="/../bad"><link href="/main.css">'),['/typed-build/app-shell.js','/main.css']);
});
test('rejects missing or empty output before hosting deploy',()=>{
 const root=mkdtempSync(join(tmpdir(),'hafize-assets-'));
 try{mkdirSync(join(root,'public','typed-build'),{recursive:true});writeFileSync(join(root,'public','index.html'),'<form id="composer"></form><script src="/typed-build/app-shell.js"></script><link href="/main.css">');
 writeFileSync(join(root,'public','typed-build','app-shell.js'),'export {};');writeFileSync(join(root,'public','main.css'),'');
 assert.deepEqual(auditLocalBuild(root).problems,['ASSET_MISSING:/main.css']);writeFileSync(join(root,'public','main.css'),'body{}');assert.equal(auditLocalBuild(root).ok,true);
 }finally{rmSync(root,{recursive:true,force:true});}
});
