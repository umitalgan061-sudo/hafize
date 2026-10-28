// Rollback / compensating actions. Every state-changing tool call records how to undo itself; the
// user (or the model, via action_undo) can then reverse it. Compensations are plain data handled by
// registered compensators, so nothing executable is stored.
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export interface Compensation {
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
export type Compensator = (payload: Readonly<Record<string, unknown>>, context: { readonly ownerId: string }) => Promise<unknown>;

export class ActionJournalError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'ActionJournalError'; this.code = code; this.status = status; }
}

export function createActionJournal({ db, now = () => Date.now() }: { readonly db: DatabaseSync; readonly now?: () => number }) {
  const compensators = new Map<string, Compensator>();

  function registerCompensator(type: string, compensator: Compensator): void {
    compensators.set(type, compensator);
  }

  function record({ ownerId, traceId, tool, summary, compensation }: { readonly ownerId: string; readonly traceId: string; readonly tool: string; readonly summary: string; readonly compensation: Compensation }): string {
    if (!compensators.has(compensation.type)) throw new ActionJournalError('UNKNOWN_COMPENSATION', 500);
    const id = randomUUID();
    db.prepare('INSERT INTO actions (id, owner_id, trace_id, tool, summary, compensation, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, ownerId, traceId, tool, summary.slice(0, 300), JSON.stringify(compensation), 'done', now());
    return id;
  }

  async function undo(id: string, ownerId: string): Promise<{ undone: true; id: string; summary: string; result: unknown }> {
    const row = db.prepare('SELECT * FROM actions WHERE id = ? AND owner_id = ?').get(id, ownerId) as Record<string, unknown> | undefined;
    if (!row) throw new ActionJournalError('ACTION_NOT_FOUND', 404);
    if (row.status !== 'done') throw new ActionJournalError('ACTION_ALREADY_UNDONE', 409);
    const compensation = JSON.parse(String(row.compensation)) as Compensation;
    const compensator = compensators.get(compensation.type);
    if (!compensator) throw new ActionJournalError('UNKNOWN_COMPENSATION', 500);
    // Claim the row first so two concurrent undo requests cannot both run the compensation.
    const claimed = db.prepare("UPDATE actions SET status = 'undoing' WHERE id = ? AND status = 'done'").run(id).changes;
    if (!claimed) throw new ActionJournalError('ACTION_ALREADY_UNDONE', 409);
    try {
      const result = await compensator(compensation.payload, { ownerId });
      db.prepare("UPDATE actions SET status = 'undone', undone_at = ? WHERE id = ?").run(now(), id);
      return { undone: true, id, summary: String(row.summary), result };
    } catch (error) {
      db.prepare("UPDATE actions SET status = 'done' WHERE id = ?").run(id);
      throw error;
    }
  }

  function list(ownerId: string, limit = 30) {
    return (db.prepare('SELECT id, trace_id AS traceId, tool, summary, status, created_at AS createdAt, undone_at AS undoneAt FROM actions WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?').all(ownerId, Math.min(Math.max(limit, 1), 200)) as Array<Record<string, unknown>>);
  }

  return Object.freeze({ registerCompensator, record, undo, list });
}
export type ActionJournal = ReturnType<typeof createActionJournal>;
