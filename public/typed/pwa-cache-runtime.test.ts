import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {describe,it,expect} from 'vitest';

describe('PWA cache runtime regression',()=>{
  for(const name of ['test-pwa-cache-policy.mjs','test-pwa-service-worker-runtime.mjs']){
    it(name,()=>{
      const path=fileURLToPath(new URL('../../scripts/'+name,import.meta.url));
      expect(execFileSync(process.execPath,[path],{encoding:'utf8',timeout:10000})).toContain('OK:');
    });
  }
});
