import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('restored CI panel integration',()=>{
 it('requires an owner principal and protects the endpoint in production guard',()=>{
  expect(read('server.ts')).toContain("url.pathname === '/api/github/app/ci'");
  expect(read('server.ts')).toContain("if(!req.__hafizePrincipal?.ownerId)");
  expect(read('lib/production-guard.ts')).toContain("'/api/github/app/ci'");
 });
 it('ships the panel and includes it in the current offline shell',()=>{
  expect(read('public/index.html')).toContain('/typed-build/github-app-ci-panel.js');
  expect(read('public/sw-policy.ts')).toContain('/typed-build/github-app-ci-panel.js');
  expect(read('vite.config.ts')).toContain("'github-app-ci-panel':");
 });
});
