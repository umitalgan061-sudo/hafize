// Results of background work (scheduled tasks and rule runs). The worker only marks a task as
// done, so without this the answer an agent produced in the background was simply lost. Task text
// and answers are personal, so they are encrypted at rest with the owner's key.
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

const MAX_CONTENT = 20_000;
const KEEP_PER_OWNER = 100;

export interface TaskResult {
  readonly id: string;
  readonly task: string;
  readonly ok: boolean;
  readonly content: string;
  readonly error: string;
  readonly createdAt: string;
  readonly readAt: string | null;
}
type Cipher = { encrypt(plain: string): string; decrypt(sealed: string): string };
type Row = { id: string; owner_id: string; ok: number; body_enc: string; error: string; created_at: number; read_at: number | null };

export function createTaskResults({ db, cipherFor, now = () => Date.now() }: { readonly db: DatabaseSync; readonly cipherFor: (ownerId: string) => Cipher; readonly now?: () => number }) {
  const toResult = (row: Row): TaskResult | null => {
    try {
      const body = JSON.parse(cipherFor(row.owner_id).decrypt(row.body_enc)) as { task?: string; content?: string };
      return Object.freeze({ id: row.id, task: String(body.task ?? ''), ok: row.ok === 1, content: String(body.content ?? ''), error: row.error, createdAt: new Date(row.created_at).toISOString(), readAt: row.read_at == null ? null : new Date(row.read_at).toISOString() });
    } catch { return null; }
  };

  function record({ ownerId, task, ok, content = '', error = '' }: { readonly ownerId: string; readonly task: string; readonly ok: boolean; readonly content?: string; readonly error?: string }): string | null {
    if (!ownerId) return null;
    const id = `res_${randomUUID()}`;
    const body = JSON.stringify({ task: String(task).slice(0, 4_000), content: String(content).slice(0, MAX_CONTENT) });
    db.prepare('INSERT INTO task_results (id, owner_id, ok, body_enc, error, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, NULL)')
      .run(id, ownerId, ok ? 1 : 0, cipherFor(ownerId).encrypt(body), String(error).slice(0, 120), now());
    db.prepare('DELETE FROM task_results WHERE owner_id = ? AND id NOT IN (SELECT id FROM task_results WHERE owner_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?)').run(ownerId, ownerId, KEEP_PER_OWNER);
    return id;
  }
  function list(ownerId: string, { limit = 50 }: { readonly limit?: number } = {}): TaskResult[] {
    const rows = db.prepare('SELECT * FROM task_results WHERE owner_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?').all(ownerId, Math.min(Math.max(limit, 1), KEEP_PER_OWNER)) as unknown as Row[];
    return rows.map(toResult).filter((item): item is TaskResult => item !== null);
  }
  function markRead(ownerId: string, id?: string): number {
    const at = now();
    const result = id
      ? db.prepare('UPDATE task_results SET read_at = ? WHERE owner_id = ? AND id = ? AND read_at IS NULL').run(at, ownerId, id)
      : db.prepare('UPDATE task_results SET read_at = ? WHERE owner_id = ? AND read_at IS NULL').run(at, ownerId);
    return Number(result.changes);
  }
  function remove(ownerId: string, id: string): boolean {
    return Number(db.prepare('DELETE FROM task_results WHERE owner_id = ? AND id = ?').run(ownerId, id).changes) > 0;
  }
  return Object.freeze({ record, list, markRead, remove });
}
export type TaskResults = ReturnType<typeof createTaskResults>;
