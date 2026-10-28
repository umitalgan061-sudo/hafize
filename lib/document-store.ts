// Uploaded text/code documents. The composer inserts only a compact reference
// (`[Ekli dosya: name](/api/documents/doc_...)`) into the message, so the raw content never floods
// the chat; the server expands the reference for the model at request time. Content is encrypted at
// rest with the owner's data key, exactly like memory records.
import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { OwnerCipher } from './envelope-crypto.ts';

const DOCUMENT_ID = /^doc_[a-f0-9]{20}$/;
const MAX_DOCUMENTS = 50;
const MAX_REFERENCES = 24;
// Storage is cheap (SQLite + the owner's own key), so the ceiling is generous. The model-facing
// budget lives in hafize-platform.ts: what is *stored* may be large, what is *sent* is bounded.
const MAX_DOCUMENT_CHARS = 50 * 1024 * 1024;
const MAX_NAME_LENGTH = 120;

export class DocumentStoreError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'DocumentStoreError'; this.code = code; this.status = status }
}

function fail(code: string, status = 400): never {
  throw new DocumentStoreError(code, status);
}

export interface StoredDocument {
  readonly id: string;
  readonly name: string;
  readonly mime: string;
  readonly size: number;
  readonly content: string;
}

export function createDocumentStore({ db, now = () => Date.now() }: { readonly db: DatabaseSync; readonly now?: () => number }) {
  /** Stores an uploaded document and returns its public reference. */
  function save(input: { readonly ownerId: string; readonly name: unknown; readonly content: unknown; readonly mime?: unknown }, cipher: OwnerCipher): { id: string; url: string; name: string; size: number } {
    const ownerId = typeof input.ownerId === 'string' ? input.ownerId.trim() : '';
    if (!ownerId) fail('DOCUMENT_OWNER_REQUIRED');
    const name = String(input.name ?? '').replace(/[\0\r\n]/g, ' ').trim().slice(0, MAX_NAME_LENGTH) || 'dosya';
    const content = typeof input.content === 'string' ? input.content : '';
    if (!content.trim()) fail('DOCUMENT_EMPTY');
    if (content.length > MAX_DOCUMENT_CHARS) fail('DOCUMENT_TOO_LARGE', 413);
    const mime = typeof input.mime === 'string' && input.mime.length <= 120 ? input.mime : 'text/plain';

    // Keep the per-owner document count bounded so uploads cannot grow without limit.
    const owned = db.prepare('SELECT COUNT(*) AS count FROM documents WHERE owner_id = ?').get(ownerId) as { count: number };
    if (owned.count >= MAX_DOCUMENTS) {
      const oldest = db.prepare('SELECT id FROM documents WHERE owner_id = ? ORDER BY created_at ASC LIMIT 1').get(ownerId) as { id: string } | undefined;
      if (oldest) db.prepare('DELETE FROM documents WHERE id = ?').run(oldest.id);
    }

    const id = `doc_${randomBytes(10).toString('hex')}`;
    db.prepare('INSERT INTO documents (id, owner_id, name, mime, size, content_enc, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, ownerId, name, mime, content.length, cipher.encrypt(content), now());
    return { id, url: `/api/documents/${id}`, name, size: content.length };
  }

  function read(id: string, ownerId: string, cipher: OwnerCipher): StoredDocument | null {
    if (!DOCUMENT_ID.test(id)) return null;
    const row = db.prepare('SELECT name, mime, size, content_enc FROM documents WHERE id = ? AND owner_id = ?').get(id, ownerId) as { name: string; mime: string; size: number; content_enc: string } | undefined;
    if (!row) return null;
    try { return { id, name: row.name, mime: row.mime, size: row.size, content: cipher.decrypt(row.content_enc) }; } catch { return null; }
  }

  function remove(id: string, ownerId: string): boolean {
    const result = db.prepare('DELETE FROM documents WHERE id = ? AND owner_id = ?').run(id, ownerId);
    return Number(result.changes) > 0;
  }

  /** Newest-first list for one owner. The ceiling matches the storage cap so the UI can show all of
   *  an owner's documents without a second page. */
  function list(ownerId: string, limit = MAX_DOCUMENTS) {
    return db.prepare('SELECT id, name, mime, size, created_at AS createdAt FROM documents WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?').all(ownerId, Math.min(Math.max(limit, 1), MAX_DOCUMENTS));
  }

  /** Document ids referenced as /api/documents/<id> in a text (all of them; the caller caps how
   *  many it expands, so this list and the store's own eviction can never disagree). */
  function referencedIds(text: string): string[] {
    return [...new Set([...String(text).matchAll(/\/api\/documents\/(doc_[a-f0-9]{20})/g)].map((match) => match[1]!))].slice(0, MAX_REFERENCES);
  }

  return Object.freeze({ save, read, remove, list, referencedIds });
}

export type DocumentStore = ReturnType<typeof createDocumentStore>;
