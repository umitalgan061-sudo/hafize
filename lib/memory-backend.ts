// Long-term memory backend: put / query / delete / export / purge per owner and namespace.
// Content and vectors are encrypted at rest with the owner's data key (shared and public
// namespaces use their own keys). Retrieval is hybrid: dense (embedding cosine) + sparse (BM25 over
// keyed token hashes) fused with reciprocal-rank fusion, plus metadata filters and a recency boost.
import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { transaction } from './hafize-db.ts';
import type { EnvelopeCrypto, OwnerCipher } from './envelope-crypto.ts';
import { containsPlaintextCredential } from './plaintext-credential-policy.ts';

export const MEMORY_KINDS = Object.freeze(['semantic', 'episodic', 'procedural'] as const);
export const MEMORY_NAMESPACES = Object.freeze(['private', 'shared', 'public'] as const);
export type MemoryKind = typeof MEMORY_KINDS[number];
export type MemoryNamespace = typeof MEMORY_NAMESPACES[number];

export const MEMORY_BACKEND_LIMITS = Object.freeze({ maxContent: 4_000, maxTags: 12, maxTag: 40, maxPerOwner: 5_000, topK: 50 });

export interface MemoryRecord {
  readonly id: string;
  readonly namespace: MemoryNamespace;
  readonly kind: MemoryKind;
  readonly content: string;
  readonly tags: readonly string[];
  readonly source: string;
  readonly sourceRef: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string | null;
}
export interface ScoredMemory extends MemoryRecord {
  readonly score: number;
  readonly signals: { readonly dense: number | null; readonly sparse: number | null };
}
export interface MemoryFilter {
  readonly tags?: readonly string[];
  readonly since?: number;
  readonly until?: number;
  readonly source?: string;
}
type Embedder = (texts: readonly string[], options: { kind: 'query' | 'passage' }) => Promise<{ vectors: number[][]; model: string } | null>;

export class MemoryBackendError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'MemoryBackendError'; this.code = code; this.status = status; }
}

const STOPWORDS = new Set('ve veya ile de da ki bu şu o bir için gibi çok daha en mi mı mu mü ne ama fakat ise ya the a an of to in on and or is are was be it this that'.split(' ').map((word) => foldTurkish(word)));

function foldTurkish(value: string): string {
  return value.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/** Search tokens: folded, stop words removed, cut to a 6-letter stem so Turkish suffixes still match. */
export function tokenize(text: string): string[] {
  const tokens = foldTurkish(String(text)).split(/[^a-z0-9]+/).filter((token) => token.length >= 2 && !STOPWORDS.has(token));
  return [...new Set(tokens.map((token) => (/^\d+$/.test(token) ? token : token.slice(0, 6))))].slice(0, 400);
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0; let na = 0; let nb = 0;
  for (let index = 0; index < a.length; index += 1) { const x = a[index]!; const y = b[index]!; dot += x * y; na += x * x; nb += y * y; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function cleanContent(value: unknown): string {
  const text = typeof value === 'string' ? value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim() : '';
  if (!text) throw new MemoryBackendError('INVALID_MEMORY_CONTENT');
  if (text.length > MEMORY_BACKEND_LIMITS.maxContent) throw new MemoryBackendError('MEMORY_CONTENT_TOO_LONG');
  if (containsPlaintextCredential(text)) throw new MemoryBackendError('MEMORY_SECRET_BLOCKED', 403);
  return text;
}
function cleanTags(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new MemoryBackendError('INVALID_MEMORY_TAGS');
  return [...new Set(value.map((tag) => String(tag).replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr').slice(0, MEMORY_BACKEND_LIMITS.maxTag)).filter(Boolean))].slice(0, MEMORY_BACKEND_LIMITS.maxTags);
}
export function newMemoryId(): string {
  return 'm' + Date.now().toString(36) + randomBytes(3).toString('hex');
}

const KEY_OWNER: Readonly<Record<MemoryNamespace, (ownerId: string) => string>> = Object.freeze({
  private: (ownerId: string) => ownerId,
  shared: () => '__shared__',
  public: () => '__public__'
});

export function createMemoryBackend({ db, crypto, embed = null, now = () => Date.now() }: { readonly db: DatabaseSync; readonly crypto: EnvelopeCrypto; readonly embed?: Embedder | null; readonly now?: () => number }) {
  const vectorCache = new Map<string, Map<string, Float32Array>>();

  const cipherFor = (ownerId: string, namespace: MemoryNamespace): OwnerCipher => crypto.forOwner(KEY_OWNER[namespace](ownerId));
  const ownerScope = (ownerId: string, namespace: MemoryNamespace) => (namespace === 'private' ? ownerId : KEY_OWNER[namespace](ownerId));

  function assertNamespace(value: unknown): MemoryNamespace {
    const namespace = (value === undefined ? 'private' : value) as MemoryNamespace;
    if (!MEMORY_NAMESPACES.includes(namespace)) throw new MemoryBackendError('INVALID_MEMORY_NAMESPACE');
    return namespace;
  }
  function assertKind(value: unknown): MemoryKind {
    const kind = (value === undefined ? 'semantic' : value) as MemoryKind;
    if (!MEMORY_KINDS.includes(kind)) throw new MemoryBackendError('INVALID_MEMORY_KIND');
    return kind;
  }

  function decode(row: Record<string, unknown>): MemoryRecord {
    const namespace = row.namespace as MemoryNamespace;
    const cipher = crypto.forOwner(namespace === 'private' ? String(row.owner_id) : KEY_OWNER[namespace](''));
    return Object.freeze({
      id: String(row.id),
      namespace,
      kind: row.kind as MemoryKind,
      content: cipher.decrypt(String(row.content_enc)),
      tags: Object.freeze(JSON.parse(String(row.tags || '[]')) as string[]),
      source: String(row.source),
      sourceRef: String(row.source_ref || ''),
      createdAt: new Date(Number(row.created_at)).toISOString(),
      updatedAt: new Date(Number(row.updated_at)).toISOString(),
      expiresAt: row.expires_at === null || row.expires_at === undefined ? null : new Date(Number(row.expires_at)).toISOString()
    });
  }

  function indexTokens(rid: number, cipher: OwnerCipher, content: string, tags: readonly string[]): void {
    db.prepare('DELETE FROM memory_fts WHERE rowid = ?').run(rid);
    const tokens = tokenize(`${content} ${tags.join(' ')}`).map((token) => cipher.tokenHash(token));
    if (tokens.length) db.prepare('INSERT INTO memory_fts (rowid, tokens) VALUES (?, ?)').run(rid, tokens.join(' '));
  }

  async function storeEmbedding(id: string, scope: string, cipher: OwnerCipher, content: string): Promise<void> {
    if (!embed) return;
    try {
      const result = await embed([content], { kind: 'passage' });
      if (!result?.vectors[0]) return;
      db.prepare('UPDATE memories SET embedding_enc = ?, embedding_model = ? WHERE id = ?').run(cipher.encryptVector(result.vectors[0]), result.model, id);
      vectorCache.get(scope)?.set(id, Float32Array.from(result.vectors[0]));
    } catch { /* retrieval falls back to BM25 for this record */ }
  }

  async function put(input: {
    readonly ownerId: string; readonly content: unknown; readonly namespace?: unknown; readonly kind?: unknown; readonly tags?: unknown;
    readonly source?: string; readonly sourceRef?: string; readonly ttlMs?: number | undefined; readonly consentScope?: string | undefined; readonly id?: string | undefined;
  }): Promise<MemoryRecord & { readonly created: boolean }> {
    const ownerId = String(input.ownerId || '');
    if (!ownerId) throw new MemoryBackendError('INVALID_OWNER');
    const namespace = assertNamespace(input.namespace);
    // Writing outside the private namespace widens who can read the note, so it needs explicit consent.
    if (namespace !== 'private' && input.consentScope !== namespace) throw new MemoryBackendError('MEMORY_NAMESPACE_CONSENT_REQUIRED', 403);
    const kind = assertKind(input.kind);
    const content = cleanContent(input.content);
    const tags = cleanTags(input.tags);
    const source = String(input.source || 'user').slice(0, 40);
    const sourceRef = String(input.sourceRef || '').slice(0, 120);
    const ttl = Number(input.ttlMs);
    const expiresAt = Number.isFinite(ttl) && ttl > 0 ? now() + ttl : null;
    const scope = ownerScope(ownerId, namespace);
    const cipher = cipherFor(ownerId, namespace);
    const existing = listRows(scope, { namespace, kind }).find((row) => row.content.toLocaleLowerCase('tr') === content.toLocaleLowerCase('tr'));
    if (existing) return { ...existing, created: false };
    const count = Number((db.prepare('SELECT COUNT(*) AS n FROM memories WHERE owner_id = ?').get(scope) as { n: number }).n);
    if (count >= MEMORY_BACKEND_LIMITS.maxPerOwner) throw new MemoryBackendError('MEMORY_FULL', 409);
    const id = input.id && /^[A-Za-z0-9_-]{1,40}$/.test(input.id) ? input.id : newMemoryId();
    const timestamp = now();
    transaction(db, () => {
      if (sourceRef) {
        for (const old of db.prepare('SELECT rid FROM memories WHERE owner_id = ? AND source = ? AND source_ref = ?').all(scope, source, sourceRef) as Array<{ rid: number }>) {
          db.prepare('DELETE FROM memory_fts WHERE rowid = ?').run(old.rid);
          db.prepare('DELETE FROM memories WHERE rid = ?').run(old.rid);
        }
        vectorCache.delete(scope);
      }
      const result = db.prepare('INSERT INTO memories (id, owner_id, namespace, kind, content_enc, tags, source, source_ref, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, scope, namespace, kind, cipher.encrypt(content), JSON.stringify(tags), source, sourceRef, timestamp, timestamp, expiresAt);
      indexTokens(Number(result.lastInsertRowid), cipher, content, tags);
    });
    await storeEmbedding(id, scope, cipher, content);
    return { ...get(ownerId, id)!, created: true };
  }

  function get(ownerId: string, id: string): MemoryRecord | null {
    const row = db.prepare("SELECT * FROM memories WHERE id = ? AND (owner_id = ? OR namespace IN ('shared', 'public'))").get(id, ownerId) as Record<string, unknown> | undefined;
    return row ? decode(row) : null;
  }

  function listRows(scope: string, { namespace, kind, limit = 1_000 }: { readonly namespace?: MemoryNamespace; readonly kind?: MemoryKind; readonly limit?: number } = {}): MemoryRecord[] {
    const clauses = ['owner_id = ?', '(expires_at IS NULL OR expires_at > ?)'];
    const params: Array<string | number> = [scope, now()];
    if (namespace) { clauses.push('namespace = ?'); params.push(namespace); }
    if (kind) { clauses.push('kind = ?'); params.push(kind); }
    params.push(Math.min(Math.max(limit, 1), 5_000));
    return (db.prepare(`SELECT * FROM memories WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC LIMIT ?`).all(...params) as Array<Record<string, unknown>>).map(decode);
  }

  function list(ownerId: string, options: { readonly namespace?: unknown; readonly kind?: unknown; readonly limit?: number } = {}): MemoryRecord[] {
    const kind = options.kind === undefined || options.kind === '' ? undefined : assertKind(options.kind);
    const namespaces = options.namespace === undefined || options.namespace === '' ? MEMORY_NAMESPACES : [assertNamespace(options.namespace)];
    return namespaces.flatMap((namespace) => listRows(ownerScope(ownerId, namespace), { namespace, ...(kind ? { kind } : {}), limit: options.limit ?? 500 }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, options.limit ?? 500);
  }

  async function update(ownerId: string, id: string, changes: { readonly content?: unknown; readonly tags?: unknown }): Promise<MemoryRecord> {
    const row = db.prepare('SELECT * FROM memories WHERE id = ? AND owner_id = ?').get(id, ownerId) as Record<string, unknown> | undefined;
    if (!row) throw new MemoryBackendError('MEMORY_NOT_FOUND', 404);
    const current = decode(row);
    const content = changes.content === undefined ? current.content : cleanContent(changes.content);
    const tags = changes.tags === undefined ? [...current.tags] : cleanTags(changes.tags);
    const cipher = cipherFor(ownerId, current.namespace);
    transaction(db, () => {
      db.prepare('UPDATE memories SET content_enc = ?, tags = ?, updated_at = ?, embedding_enc = NULL WHERE id = ?').run(cipher.encrypt(content), JSON.stringify(tags), now(), id);
      indexTokens(Number(row.rid), cipher, content, tags);
    });
    vectorCache.get(ownerId)?.delete(id);
    if (content !== current.content) await storeEmbedding(id, ownerId, cipher, content);
    return get(ownerId, id)!;
  }

  function remove(ownerId: string, ids: readonly string[]): number {
    let removed = 0;
    transaction(db, () => {
      for (const id of ids.slice(0, 500)) {
        const row = db.prepare('SELECT rid FROM memories WHERE id = ? AND owner_id = ?').get(id, ownerId) as { rid: number } | undefined;
        if (!row) continue;
        db.prepare('DELETE FROM memory_fts WHERE rowid = ?').run(row.rid);
        db.prepare('DELETE FROM memories WHERE rid = ?').run(row.rid);
        removed += 1;
      }
    });
    vectorCache.delete(ownerId);
    return removed;
  }

  function removeBySourceRef(ownerId: string, source: string, sourceRef: string): number {
    const row = db.prepare('SELECT id FROM memories WHERE owner_id = ? AND source = ? AND source_ref = ?').get(ownerId, source, sourceRef) as { id: string } | undefined;
    return row ? remove(ownerId, [row.id]) : 0;
  }

  /** Deletes everything the owner has, including the owner's data key (crypto-shredding). */
  function purge(ownerId: string): number {
    let removed = 0;
    transaction(db, () => {
      db.prepare('DELETE FROM memory_fts WHERE rowid IN (SELECT rid FROM memories WHERE owner_id = ?)').run(ownerId);
      removed = Number(db.prepare('DELETE FROM memories WHERE owner_id = ?').run(ownerId).changes);
      db.prepare('DELETE FROM episodes WHERE owner_id = ?').run(ownerId);
    });
    crypto.forgetOwner(ownerId);
    vectorCache.delete(ownerId);
    return removed;
  }

  function exportJsonl(ownerId: string): string {
    return listRows(ownerId, { limit: 5_000 }).map((record) => JSON.stringify(record)).join('\n') + '\n';
  }

  async function importJsonl(ownerId: string, text: string, { source = 'import' }: { readonly source?: string } = {}): Promise<{ imported: number; skipped: number }> {
    let imported = 0; let skipped = 0;
    for (const line of String(text).split(/\r?\n/).slice(0, 5_000)) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line) as Record<string, unknown>;
        // Last-writer-wins: an imported note replaces an older copy of the same id.
        const existing = typeof item.id === 'string' ? get(ownerId, item.id) : null;
        if (existing && typeof item.updatedAt === 'string' && existing.updatedAt >= item.updatedAt) { skipped += 1; continue; }
        if (existing) remove(ownerId, [existing.id]);
        const result = await put({ ownerId, content: item.content, kind: item.kind, tags: item.tags, source: typeof item.source === 'string' ? item.source : source, sourceRef: typeof item.sourceRef === 'string' ? item.sourceRef : '', id: typeof item.id === 'string' ? item.id : undefined });
        if (result.created) imported += 1; else skipped += 1;
      } catch { skipped += 1; }
    }
    return { imported, skipped };
  }

  function vectorsFor(scope: string, namespace: MemoryNamespace): Map<string, Float32Array> {
    let cached = vectorCache.get(scope);
    if (cached) return cached;
    cached = new Map();
    const cipher = crypto.forOwner(namespace === 'private' ? scope : KEY_OWNER[namespace](''));
    for (const row of db.prepare('SELECT id, embedding_enc FROM memories WHERE owner_id = ? AND embedding_enc IS NOT NULL').all(scope) as Array<{ id: string; embedding_enc: string }>) {
      try { cached.set(row.id, cipher.decryptVector(row.embedding_enc)); } catch {}
    }
    vectorCache.set(scope, cached);
    return cached;
  }

  async function query({ ownerId, query: text, namespaces, kinds, topK = 8, filter = {} }: {
    readonly ownerId: string; readonly query: string; readonly namespaces?: readonly unknown[]; readonly kinds?: readonly unknown[]; readonly topK?: number; readonly filter?: MemoryFilter;
  }): Promise<ScoredMemory[]> {
    const queryText = String(text || '').trim().slice(0, 2_000);
    const scopes = (namespaces?.length ? namespaces.map(assertNamespace) : [...MEMORY_NAMESPACES]);
    const allowedKinds = kinds?.length ? new Set(kinds.map(assertKind)) : null;
    const limit = Math.min(Math.max(Math.trunc(topK), 1), MEMORY_BACKEND_LIMITS.topK);
    const queryVector = queryText && embed ? (await embed([queryText], { kind: 'query' }).catch(() => null))?.vectors[0] ?? null : null;
    const candidates = new Map<string, { record: MemoryRecord; dense: number | null; sparse: number | null; denseRank: number; sparseRank: number }>();
    const filterTags = filter.tags?.length ? cleanTags(filter.tags) : [];
    const accept = (record: MemoryRecord) => (!allowedKinds || allowedKinds.has(record.kind))
      && (!filterTags.length || filterTags.every((tag) => record.tags.includes(tag)))
      && (!filter.source || record.source === filter.source)
      && (!filter.since || Date.parse(record.createdAt) >= filter.since)
      && (!filter.until || Date.parse(record.createdAt) <= filter.until);

    for (const namespace of scopes) {
      const scope = ownerScope(ownerId, namespace);
      const cipher = cipherFor(ownerId, namespace);
      const records = new Map(listRows(scope, { namespace, limit: 5_000 }).filter(accept).map((record) => [record.id, record]));
      if (!records.size) continue;
      if (queryText) {
        const hashed = tokenize(queryText).map((token) => `"${cipher.tokenHash(token)}"`);
        if (hashed.length) {
          const rows = db.prepare(`SELECT m.id AS id, bm25(memory_fts) AS rank FROM memory_fts JOIN memories m ON m.rid = memory_fts.rowid WHERE memory_fts MATCH ? AND m.owner_id = ? ORDER BY rank LIMIT 200`).all(hashed.join(' OR '), scope) as Array<{ id: string; rank: number }>;
          rows.forEach((row, index) => {
            const record = records.get(row.id);
            if (!record) return;
            const entry = candidates.get(row.id) ?? { record, dense: null, sparse: null, denseRank: Infinity, sparseRank: Infinity };
            entry.sparse = -Number(row.rank);
            entry.sparseRank = index;
            candidates.set(row.id, entry);
          });
        }
      }
      if (queryVector) {
        const scored = [...vectorsFor(scope, namespace).entries()].filter(([id]) => records.has(id)).map(([id, vector]) => ({ id, similarity: cosine(queryVector, vector) })).sort((a, b) => b.similarity - a.similarity).slice(0, 200);
        scored.forEach((item, index) => {
          if (item.similarity < 0.15) return;
          const entry = candidates.get(item.id) ?? { record: records.get(item.id)!, dense: null, sparse: null, denseRank: Infinity, sparseRank: Infinity };
          entry.dense = item.similarity;
          entry.denseRank = index;
          candidates.set(item.id, entry);
        });
      }
      if (!queryText) for (const record of records.values()) candidates.set(record.id, { record, dense: null, sparse: null, denseRank: Infinity, sparseRank: Infinity });
    }
    const nowMs = now();
    return [...candidates.values()].map((entry) => {
      const rrf = (Number.isFinite(entry.denseRank) ? 1 / (60 + entry.denseRank) : 0) + (Number.isFinite(entry.sparseRank) ? 1 / (60 + entry.sparseRank) : 0);
      const ageDays = Math.max(0, (nowMs - Date.parse(entry.record.updatedAt)) / 86_400_000);
      const recency = 0.002 * Math.exp(-ageDays / 30);
      return { ...entry.record, score: Math.round((rrf + recency) * 1e6) / 1e6, signals: { dense: entry.dense === null ? null : Math.round(entry.dense * 1000) / 1000, sparse: entry.sparse === null ? null : Math.round(entry.sparse * 1000) / 1000 } };
    }).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /** Computes vectors for records stored while the embedding service was unavailable. */
  async function backfillEmbeddings(limit = 50): Promise<number> {
    if (!embed) return 0;
    const rows = db.prepare('SELECT id, owner_id, namespace, content_enc FROM memories WHERE embedding_enc IS NULL LIMIT ?').all(limit) as Array<Record<string, unknown>>;
    let done = 0;
    for (const row of rows) {
      const namespace = row.namespace as MemoryNamespace;
      const cipher = crypto.forOwner(namespace === 'private' ? String(row.owner_id) : KEY_OWNER[namespace](''));
      const before = db.prepare('SELECT embedding_enc FROM memories WHERE id = ?').get(String(row.id)) as { embedding_enc: string | null };
      if (before.embedding_enc) continue;
      await storeEmbedding(String(row.id), String(row.owner_id), cipher, cipher.decrypt(String(row.content_enc)));
      const after = db.prepare('SELECT embedding_enc FROM memories WHERE id = ?').get(String(row.id)) as { embedding_enc: string | null };
      if (after.embedding_enc) done += 1; else break;
    }
    return done;
  }

  function pruneExpired(): number {
    const rows = db.prepare('SELECT rid, owner_id FROM memories WHERE expires_at IS NOT NULL AND expires_at <= ?').all(now()) as Array<{ rid: number; owner_id: string }>;
    transaction(db, () => {
      for (const row of rows) {
        db.prepare('DELETE FROM memory_fts WHERE rowid = ?').run(row.rid);
        db.prepare('DELETE FROM memories WHERE rid = ?').run(row.rid);
        vectorCache.delete(row.owner_id);
      }
    });
    return rows.length;
  }

  // --- raw conversation turns for the consolidation pipeline ---
  function recordTurn({ ownerId, conversationId, role, content }: { readonly ownerId: string; readonly conversationId: string; readonly role: 'user' | 'assistant'; readonly content: string }): void {
    const text = String(content || '').trim();
    if (!ownerId || !/^[A-Za-z0-9_-]{1,120}$/.test(conversationId) || !text) return;
    db.prepare('INSERT INTO episodes (owner_id, conversation_id, role, content_enc, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(ownerId, conversationId, role, crypto.forOwner(ownerId).encrypt(text.slice(0, 12_000)), now());
  }

  function pendingConversations({ idleMs = 20 * 60 * 1000, limit = 5 }: { readonly idleMs?: number; readonly limit?: number } = {}) {
    const rows = db.prepare('SELECT owner_id, conversation_id, MAX(created_at) AS last, COUNT(*) AS n FROM episodes WHERE consolidated_at IS NULL GROUP BY owner_id, conversation_id HAVING last <= ? ORDER BY last LIMIT ?')
      .all(now() - idleMs, limit) as Array<{ owner_id: string; conversation_id: string; last: number; n: number }>;
    return rows.map((row) => ({ ownerId: row.owner_id, conversationId: row.conversation_id, lastActivity: Number(row.last), turns: Number(row.n) }));
  }

  function conversationTurns(ownerId: string, conversationId: string) {
    const cipher = crypto.forOwner(ownerId);
    return (db.prepare('SELECT id, role, content_enc, created_at FROM episodes WHERE owner_id = ? AND conversation_id = ? AND consolidated_at IS NULL ORDER BY id').all(ownerId, conversationId) as Array<Record<string, unknown>>)
      .map((row) => ({ id: Number(row.id), role: String(row.role) as 'user' | 'assistant', content: cipher.decrypt(String(row.content_enc)), createdAt: Number(row.created_at) }));
  }

  function markConsolidated(ids: readonly number[]): void {
    transaction(db, () => { for (const id of ids) db.prepare('UPDATE episodes SET consolidated_at = ? WHERE id = ?').run(now(), id); });
  }

  return Object.freeze({ put, get, list, update, remove, removeBySourceRef, purge, exportJsonl, importJsonl, query, backfillEmbeddings, pruneExpired, recordTurn, pendingConversations, conversationTurns, markConsolidated });
}
export type MemoryBackend = ReturnType<typeof createMemoryBackend>;
