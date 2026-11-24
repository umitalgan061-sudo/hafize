import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createModelLabFileStorage } from './model-lab-storage.ts';
describe('model lab file store',()=>{
  it('writes scoped snapshots, rejects mismatched keys, omits credentials',()=>{
    const dir=mkdtempSync(join(tmpdir(),'hafize-lab-'));
    try {
      const path=join(dir,'lab.json');
      const snapshot={version:1 as const,results:[],deepResults:[],timestamps:[1],blockedUntil:0};
      const store=createModelLabFileStorage(path,'secret-test-key',['nvidia/example']);
      expect(store.load()).toBeNull();
      store.save(snapshot);
      expect(store.load()).toEqual(snapshot);
      expect(readFileSync(path,'utf8')).not.toContain('secret-test-key');
      expect(createModelLabFileStorage(path,'different-key',['nvidia/example']).load()).toBeNull();
      writeFileSync(path,'bad json');
      expect(()=>store.load()).toThrow();
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
});
