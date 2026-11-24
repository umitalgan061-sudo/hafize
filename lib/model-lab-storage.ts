import { lstatSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { ModelLabSnapshot, ModelLabStorage } from './model-lab.ts';

// Optional operator-configured local store. No user messages or credentials are stored.
export function createModelLabFileStorage(path: string, key: string, candidates: readonly string[]): ModelLabStorage {
  if (!isAbsolute(path)) throw new Error('MODEL_LAB_STORAGE_ABSOLUTE_PATH_REQUIRED');
  const scope = createHash('sha256').update(JSON.stringify([key,candidates])).digest('hex');
  return {
    load() {
      try {
        const meta = lstatSync(path);
        if (!meta.isFile() || meta.size > 128_000) throw new Error('MODEL_LAB_STORAGE_INVALID');
        const envelope = JSON.parse(readFileSync(path,'utf8'));
        return envelope?.scope === scope ? envelope.snapshot : null;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    save(snapshot: ModelLabSnapshot) {
      const temp = path + '.' + randomUUID() + '.tmp';
      try {
        const data = JSON.stringify({scope,snapshot});
        if (Buffer.byteLength(data)>128_000) throw new Error('MODEL_LAB_STORAGE_TOO_LARGE');
        writeFileSync(temp,data,{encoding:'utf8',mode:0o600,flag:'wx'});
        renameSync(temp,path);
      } finally { try { unlinkSync(temp); } catch {} }
    }
  };
}
