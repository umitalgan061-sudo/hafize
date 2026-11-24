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
        if (!meta.isFile() || meta.size > 256_000) throw new Error('MODEL_LAB_STORAGE_INVALID');
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
        if (Buffer.byteLength(data)>256_000) throw new Error('MODEL_LAB_STORAGE_TOO_LARGE');
        writeFileSync(temp,data,{encoding:'utf8',mode:0o600,flag:'wx'});
        renameSync(temp,path);
      } finally { try { unlinkSync(temp); } catch {} }
    }
  };
}

/** Uses the existing platform DB, not another paid database or GPU service. */
export function createModelLabSqliteStorage(db:import('node:sqlite').DatabaseSync,key:string,candidates:readonly string[]):ModelLabStorage{
  const scope=createHash('sha256').update(JSON.stringify([key,candidates])).digest('hex');
  db.exec('CREATE TABLE IF NOT EXISTS hafize_model_lab_snapshot(id INTEGER PRIMARY KEY CHECK(id=1),scope TEXT NOT NULL,snapshot TEXT NOT NULL)');
  return {load(){const row=db.prepare('SELECT scope,snapshot FROM hafize_model_lab_snapshot WHERE id=1').get() as {scope:string;snapshot:string}|undefined;if(!row||row.scope!==scope)return null;if(Buffer.byteLength(row.snapshot)>256000)throw Error('MODEL_LAB_STORAGE_TOO_LARGE');return JSON.parse(row.snapshot);},save(snapshot){const data=JSON.stringify(snapshot);if(Buffer.byteLength(data)>256000)throw Error('MODEL_LAB_STORAGE_TOO_LARGE');db.prepare('INSERT INTO hafize_model_lab_snapshot(id,scope,snapshot) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET scope=excluded.scope,snapshot=excluded.snapshot').run(scope,data);}};
}
