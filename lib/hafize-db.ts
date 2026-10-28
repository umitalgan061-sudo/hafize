// One local SQLite database (node:sqlite, no extra dependency) for everything Hafize keeps on the
// server: encrypted long-term memory, raw conversation turns awaiting consolidation, telemetry,
// the action journal, orchestrator checkpoints, delegation audit and generated images.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

export type HafizeDb = DatabaseSync;

export const DEFAULT_DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));

// Each entry upgrades the schema by one version (PRAGMA user_version); never edit a shipped entry.
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE owner_keys (
    owner_id TEXT PRIMARY KEY,
    wrapped_key TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE memories (
    rid INTEGER PRIMARY KEY,
    id TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL,
    namespace TEXT NOT NULL,
    kind TEXT NOT NULL,
    content_enc TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL,
    source_ref TEXT NOT NULL DEFAULT '',
    embedding_enc TEXT,
    embedding_model TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    expires_at INTEGER
  );
  CREATE INDEX memories_owner ON memories(owner_id, namespace, kind);
  CREATE UNIQUE INDEX memories_source_ref ON memories(owner_id, source, source_ref) WHERE source_ref <> '';
  CREATE VIRTUAL TABLE memory_fts USING fts5(tokens);
  CREATE TABLE episodes (
    id INTEGER PRIMARY KEY,
    owner_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content_enc TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    consolidated_at INTEGER
  );
  CREATE INDEX episodes_pending ON episodes(owner_id, conversation_id, consolidated_at);
  CREATE TABLE spans (
    span_id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL,
    parent_span_id TEXT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    status TEXT NOT NULL,
    attributes TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX spans_time ON spans(start_ms);
  CREATE INDEX spans_trace ON spans(trace_id);
  CREATE TABLE usage (
    id INTEGER PRIMARY KEY,
    trace_id TEXT NOT NULL,
    model TEXT NOT NULL,
    purpose TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX usage_time ON usage(created_at);
  CREATE TABLE feedback (
    id INTEGER PRIMARY KEY,
    owner_id TEXT NOT NULL,
    trace_id TEXT NOT NULL DEFAULT '',
    message_id TEXT NOT NULL,
    rating TEXT NOT NULL,
    prompt_variant TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    UNIQUE(owner_id, message_id)
  );
  CREATE TABLE actions (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    tool TEXT NOT NULL,
    summary TEXT NOT NULL,
    compensation TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    undone_at INTEGER
  );
  CREATE INDEX actions_owner ON actions(owner_id, created_at);
  CREATE TABLE orchestrator_runs (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    goal TEXT NOT NULL,
    status TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE orchestrator_events (
    id INTEGER PRIMARY KEY,
    run_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE INDEX orchestrator_events_run ON orchestrator_events(run_id, id);
  CREATE TABLE delegations (
    id INTEGER PRIMARY KEY,
    parent_trace_id TEXT NOT NULL,
    child_agent_id TEXT NOT NULL,
    task_hash TEXT NOT NULL,
    result_hash TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    tokens INTEGER NOT NULL,
    ok INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE agent_quota (
    agent_id TEXT NOT NULL,
    day TEXT NOT NULL,
    calls INTEGER NOT NULL DEFAULT 0,
    tokens INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(agent_id, day)
  );
  CREATE TABLE images (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt TEXT NOT NULL,
    seed INTEGER NOT NULL,
    mime TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  `,
  // Uploaded text/code documents: the composer only references them, never inlines their content,
  // so the chat stays readable while the model still receives the file.
  ` CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    content_enc TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
    CREATE INDEX documents_owner ON documents (owner_id, created_at DESC);
  `
];

export function migrate(db: DatabaseSync): number {
  const current = Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]!);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return MIGRATIONS.length;
}

export function openHafizeDb(path: string = join(DEFAULT_DATA_DIR, 'hafize.db')): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 3000;');
  migrate(db);
  return db;
}

/** Runs fn inside one transaction; nested calls join the outer one. */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  if (db.isTransaction) return fn();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
