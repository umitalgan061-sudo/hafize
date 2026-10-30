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
