import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { openHafizeDb } from './hafize-db.ts';
import { createDocumentStore } from './document-store.ts';
import { createEnvelopeCrypto } from './envelope-crypto.ts';

function setup() {
  const db = openHafizeDb(join(mkdtempSync(join(tmpdir(), 'hafize-doc-')), 'test.db'));
  const crypto = createEnvelopeCrypto({ db, masterKey: randomBytes(32) });
  // A monotonic clock so created_at ordering is deterministic in the assertions.
  let clock = 1_700_000_000_000;
  return { db, store: createDocumentStore({ db, now: () => (clock += 1_000) }), crypto };
}

describe('document store', () => {
  it('saves, reads and decrypts a document', () => {
    const { db, store, crypto } = setup();
    const cipher = crypto.forOwner('u1');
    const stored = store.save({ ownerId: 'u1', name: 'not.txt', content: '# baslik\nicerik', mime: 'text/plain' }, cipher);
    expect(stored).toMatchObject({ url: expect.stringMatching(/^\/api\/documents\/doc_[a-f0-9]{20}$/), name: 'not.txt', size: 15 });
    const read = store.read(stored.id, 'u1', cipher)!;
    expect(read.content).toBe('# baslik\nicerik');
    expect(read.name).toBe('not.txt');
    db.close();
  });

  it('never leaks a document to another owner', () => {
    const { db, store, crypto } = setup();
    const stored = store.save({ ownerId: 'u1', name: 'a.txt', content: 'gizli' }, crypto.forOwner('u1'));
    expect(store.read(stored.id, 'u2', crypto.forOwner('u2'))).toBeNull();
    expect(store.remove(stored.id, 'u2')).toBe(false);
    db.close();
  });

  it('rejects empty content, oversized content and a missing owner', () => {
    const { db, store, crypto } = setup();
    const cipher = crypto.forOwner('u1');
    expect(() => store.save({ ownerId: '', name: 'a.txt', content: 'x' }, cipher)).toThrow('DOCUMENT_OWNER_REQUIRED');
    expect(() => store.save({ ownerId: 'u1', name: 'a.txt', content: '   ' }, cipher)).toThrow('DOCUMENT_EMPTY');
    expect(() => store.save({ ownerId: 'u1', name: 'a.txt', content: 'x'.repeat(50 * 1024 * 1024 + 1) }, cipher)).toThrow('DOCUMENT_TOO_LARGE');
    db.close();
  });

  it('strips newlines from the stored name', () => {
    const { db, store, crypto } = setup();
    const stored = store.save({ ownerId: 'u1', name: 'evil\nname.txt', content: 'x' }, crypto.forOwner('u1'));
    expect(stored.name).toBe('evil name.txt');
    db.close();
  });

  it('extracts every referenced id, de-duplicated', () => {
    const { db, store, crypto } = setup();
    const ids = ['doc_' + 'a'.repeat(20), 'doc_' + 'b'.repeat(20), 'doc_' + 'c'.repeat(20)];
    const text = ids.map((id) => `[Ekli dosya: f.txt](/api/documents/${id})`).join(' ');
    expect(store.referencedIds(text)).toEqual(ids);
    // A repeated reference collapses to a single id.
    expect(store.referencedIds(`${text} ${text}`)).toEqual(ids);
    expect(store.referencedIds('no refs here')).toEqual([]);
    db.close();
  });

  it('keeps at most fifty documents per owner', () => {
    const { db, store, crypto } = setup();
    const cipher = crypto.forOwner('u1');
    for (let index = 0; index < 55; index += 1) store.save({ ownerId: 'u1', name: `f${index}.txt`, content: `c${index}` }, cipher);
    expect(store.list('u1')).toHaveLength(50);
    db.close();
  });

  it('lists only the owner documents, newest first', () => {
    const { db, store, crypto } = setup();
    store.save({ ownerId: 'u1', name: 'a.txt', content: 'a' }, crypto.forOwner('u1'));
    store.save({ ownerId: 'u1', name: 'b.txt', content: 'b' }, crypto.forOwner('u1'));
    store.save({ ownerId: 'u2', name: 'c.txt', content: 'c' }, crypto.forOwner('u2'));
    const list = store.list('u1') as Array<{ name: string }>;
    expect(list.map((item) => item.name)).toEqual(['b.txt', 'a.txt']);
    db.close();
  });
});
