import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createBackupService, decryptSnapshot, encryptSnapshot, folderTarget, snapshotTime } from './backup.ts';
import { openHafizeDb } from './hafize-db.ts';
import { createEnvelopeCrypto } from './envelope-crypto.ts';
import { createMemoryBackend } from './memory-backend.ts';

describe('backup', () => {
  it('encrypts snapshots and refuses a wrong passphrase', () => {
    const blob = encryptSnapshot({ hello: 'dünya' }, 'doğru-parola-123');
    expect(blob.includes(Buffer.from('dünya'))).toBe(false);
    expect(decryptSnapshot(blob, 'doğru-parola-123')).toEqual({ hello: 'dünya' });
    expect(() => decryptSnapshot(blob, 'yanlış-parola-123')).toThrow('BACKUP_DECRYPT_FAILED');
  });

  it('backs up to a folder and restores into a fresh install with last-writer-wins', async () => {
    const target = folderTarget(mkdtempSync(join(tmpdir(), 'hafize-backup-')));
    const make = () => {
      const db = openHafizeDb(':memory:');
      const memory = createMemoryBackend({ db, crypto: createEnvelopeCrypto({ db, masterKey: randomBytes(32) }) });
      const service = createBackupService({ db, memory, imagesDir: mkdtempSync(join(tmpdir(), 'hz-img-')), userSkillsDir: mkdtempSync(join(tmpdir(), 'hz-sk-')), target, passphrase: 'yedek-parolasi-1' });
      return { memory, service };
    };
    const source = make();
    await source.memory.put({ ownerId: 'u1', content: 'Kullanıcı kahveyi sade içer.' });
    const result = await source.service.backupNow();
    expect(result).toMatchObject({ memories: 1, target: 'folder' });

    const fresh = make();
    const restored = await fresh.service.restore();
    expect(restored.memories).toBe(1);
    expect(fresh.memory.list('u1')[0]?.content).toBe('Kullanıcı kahveyi sade içer.');
    const again = await fresh.service.restore();
    expect(again).toMatchObject({ memories: 0, skipped: 1 });
  });

  it('reads the snapshot time from its name and ignores foreign files', () => {
    expect(snapshotTime('hafize-backup-2026-10-30T08-05-09.hzb')).toBe(Date.UTC(2026, 9, 30, 8, 5, 9));
    expect(snapshotTime('notes.hzb')).toBeNull();
    expect(snapshotTime(undefined)).toBeNull();
  });

  it('backs up only when the newest snapshot is older than the interval, across restarts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-backup-due-'));
    let clock = Date.UTC(2026, 9, 30, 8, 0, 0);
    const make = () => {
      const db = openHafizeDb(':memory:');
      const memory = createMemoryBackend({ db, crypto: createEnvelopeCrypto({ db, masterKey: randomBytes(32) }) });
      return createBackupService({ db, memory, imagesDir: mkdtempSync(join(tmpdir(), 'hz-img-')), userSkillsDir: mkdtempSync(join(tmpdir(), 'hz-skill-')), target: folderTarget(dir), passphrase: 'yedek-parolasi-123', now: () => new Date(clock) });
    };
    const day = 24 * 60 * 60 * 1000;
    const first = make();
    expect(await first.backupIfDue(day)).toMatchObject({ target: 'folder' });
    expect(await first.backupIfDue(day)).toBeNull();
    clock += day - 60_000;
    // A new process (no in-memory state) still sees the snapshot on the target.
    expect(await make().backupIfDue(day)).toBeNull();
    clock += 120_000;
    expect(await make().backupIfDue(day)).toMatchObject({ target: 'folder' });
  });
});

it('restores missing task history, but never replays restored mutations or replaces existing state',async()=>{
 const target=folderTarget(mkdtempSync(join(tmpdir(),'hafize-task-restore-')));
 const make=()=>{const db=openHafizeDb(':memory:');const memory=createMemoryBackend({db,crypto:createEnvelopeCrypto({db,masterKey:randomBytes(32)})});return {db,service:createBackupService({db,memory,imagesDir:mkdtempSync(join(tmpdir(),'hz-img-')),userSkillsDir:mkdtempSync(join(tmpdir(),'hz-skill-')),target,passphrase:'yedek-parolasi-123'})};};
 const source=make();
 for(const [runId,tool] of [['read-task','web_search'],['write-task','github_develop']]){
  const state={runId,traceId:'trace-'+runId,ownerId:'u1',goal:'deliver',constraints:[],status:'running',plan:[{id:'s1',title:'step',tool,args:{},dependsOn:[],retryPolicy:{maxAttempts:2,backoffMs:0},timeoutMs:90000,checkpoint:true}],steps:{s1:{status:'running',attempts:1,approved:true}},budget:{maxSteps:100,maxWallMs:10800000,maxTokens:2000000,maxToolCalls:1600},usage:{stepsRun:0,toolCalls:1,tokens:0,wallMs:100,startedAt:1000},revisions:0,criticNotes:[]};
  source.db.prepare('INSERT INTO orchestrator_runs VALUES (?,?,?,?,?,?,?,?)').run(runId,'u1',state.traceId,state.goal,'running',JSON.stringify(state),1000,2000);
 }
 await source.service.backupNow();const fresh=make();
 expect(await fresh.service.restore()).toMatchObject({restoredRuns:2,historyOnlyRuns:1,skippedRuns:0});
 const read=JSON.parse(String(fresh.db.prepare('SELECT state FROM orchestrator_runs WHERE id=?').get('read-task')?.state));
 const write=JSON.parse(String(fresh.db.prepare('SELECT state FROM orchestrator_runs WHERE id=?').get('write-task')?.state));
 expect(read).toMatchObject({restoredFromBackup:true,status:'running'});expect(read.steps.s1.approved).toBeUndefined();
 expect(write).toMatchObject({restoredHistoryOnly:true,status:'aborted'});
 expect(await fresh.service.restore()).toMatchObject({restoredRuns:0,skippedRuns:2});
 source.db.close();fresh.db.close();
});
