import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { openHafizeDb } from './hafize-db.ts';
import { createEnvelopeCrypto } from './envelope-crypto.ts';
import { createMemoryBackend, tokenize } from './memory-backend.ts';

// Deterministic toy embedder: a bag of folded tokens hashed into 64 buckets.
async function fakeEmbed(texts: readonly string[]) {
  return {
    model: 'fake',
    vectors: texts.map((text) => {
      const vector = new Array(64).fill(0);
      for (const token of tokenize(text)) vector[[...token].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 64] += 1;
      return vector;
    })
  };
}

function setup() {
  const db = openHafizeDb(':memory:');
  const crypto = createEnvelopeCrypto({ db, masterKey: randomBytes(32) });
  return { db, backend: createMemoryBackend({ db, crypto, embed: fakeEmbed }) };
}

describe('memory backend', () => {
  it('stores content encrypted and finds it through hybrid search', async () => {
    const { db, backend } = setup();
    await backend.put({ ownerId: 'u1', content: 'Kullanıcı Ankara’da yaşıyor.', kind: 'semantic', tags: ['konum'] });
    await backend.put({ ownerId: 'u1', content: 'Kullanıcı kısa yanıtları seviyor.', kind: 'semantic' });
    await backend.put({ ownerId: 'u1', content: 'Python ile CSV okuma şablonu: pandas.read_csv', kind: 'procedural' });
    const raw = db.prepare('SELECT content_enc FROM memories').all() as Array<{ content_enc: string }>;
    expect(raw.every((row) => !row.content_enc.includes('Ankara'))).toBe(true);
    const fts = db.prepare('SELECT tokens FROM memory_fts').all() as Array<{ tokens: string }>;
    expect(fts.every((row) => !row.tokens.includes('ankara'))).toBe(true);

    const hits = await backend.query({ ownerId: 'u1', query: 'Ankarada mı yaşıyor?' });
    expect(hits[0]?.content).toContain('Ankara');
    expect(hits[0]?.signals.sparse).not.toBeNull();
    const procedural = await backend.query({ ownerId: 'u1', query: 'csv', kinds: ['procedural'] });
    expect(procedural).toHaveLength(1);
    const tagged = await backend.query({ ownerId: 'u1', query: '', filter: { tags: ['konum'] } });
    expect(tagged.map((item) => item.content)).toEqual(['Kullanıcı Ankara’da yaşıyor.']);
  });

  it('keeps owners apart and requires consent for shared namespaces', async () => {
    const { backend } = setup();
    await backend.put({ ownerId: 'u1', content: 'Gizli tercih: koyu tema.' });
    expect(await backend.query({ ownerId: 'u2', query: 'koyu tema' })).toHaveLength(0);
    await expect(backend.put({ ownerId: 'u1', content: 'Ekip kuralı', namespace: 'shared' })).rejects.toThrow('MEMORY_NAMESPACE_CONSENT_REQUIRED');
    await backend.put({ ownerId: 'u1', content: 'Ekip kuralı: PR’lar küçük olsun', namespace: 'shared', consentScope: 'shared' });
    expect((await backend.query({ ownerId: 'u2', query: 'ekip kuralı' }))[0]?.namespace).toBe('shared');
  });

  it('deduplicates, rejects secrets, exports, imports and purges', async () => {
    const { backend } = setup();
    const first = await backend.put({ ownerId: 'u1', content: 'Adı Deniz.' });
    const again = await backend.put({ ownerId: 'u1', content: 'adı deniz.' });
    expect(again.created).toBe(false);
    expect(again.id).toBe(first.id);
    await expect(backend.put({ ownerId: 'u1', content: 'password: hunter2hunter2' })).rejects.toThrow('MEMORY_SECRET_BLOCKED');
    const jsonl = backend.exportJsonl('u1');
    expect(jsonl.trim().split('\n')).toHaveLength(1);
    expect(backend.purge('u1')).toBe(1);
    expect(backend.list('u1')).toHaveLength(0);
    const restored = await backend.importJsonl('u1', jsonl);
    expect(restored.imported).toBe(1);
    expect(backend.list('u1')[0]?.content).toBe('Adı Deniz.');
  });

  it('expires notes with a TTL and tracks conversation turns for consolidation', async () => {
    let clock = 1_000_000;
    const db = openHafizeDb(':memory:');
    const backend = createMemoryBackend({ db, crypto: createEnvelopeCrypto({ db, masterKey: randomBytes(32) }), now: () => clock });
    await backend.put({ ownerId: 'u1', content: 'Geçici not', ttlMs: 1_000 });
    clock += 2_000;
    expect(backend.list('u1')).toHaveLength(0);
    expect(backend.pruneExpired()).toBe(1);
    backend.recordTurn({ ownerId: 'u1', conversationId: 'c1', role: 'user', content: 'Merhaba' });
    backend.recordTurn({ ownerId: 'u1', conversationId: 'c1', role: 'assistant', content: 'Selam!' });
    clock += 30 * 60 * 1000;
    const pending = backend.pendingConversations();
    expect(pending).toEqual([expect.objectContaining({ ownerId: 'u1', conversationId: 'c1', turns: 2 })]);
    const turns = backend.conversationTurns('u1', 'c1');
    expect(turns.map((turn) => turn.content)).toEqual(['Merhaba', 'Selam!']);
    backend.markConsolidated(turns.map((turn) => turn.id));
    expect(backend.pendingConversations()).toHaveLength(0);
  });
});
