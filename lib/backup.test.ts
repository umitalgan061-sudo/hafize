import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createBackupService, decryptSnapshot, encryptSnapshot, folderTarget } from './backup.ts';
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
});
