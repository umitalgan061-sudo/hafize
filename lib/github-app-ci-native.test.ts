import {describe,it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
describe('native production runtime import',()=>{
 it('loads GitHub CI module using Node strip-only mode, without a transpiler',()=>{
  const url=new URL('./github-app-ci.ts',import.meta.url);
  const script='const m=await import('+JSON.stringify(url.href)+');const e=new m.GitHubAppCiError("TEST",403);if(e.code!=="TEST"||e.status!==403)process.exit(1);';
  expect(()=>execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:fileURLToPath(new URL('../',import.meta.url)),timeout:10000})).not.toThrow();
 });
});
