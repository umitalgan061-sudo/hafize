import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createEnvelopeCrypto } from './envelope-crypto.ts';
import { openHafizeDb } from './hafize-db.ts';
import { createRuleEngine, type Rule } from './rule-engine.ts';
import { createTaskResults } from './task-results.ts';
import { createWorkspaceWatcher, normalizeWatchedPath } from './workspace-watcher.ts';

function memoryStore() {
  const rows = new Map<string, Rule>();
  return { rows, load: () => [...rows.values()], save: (rule: Rule) => { rows.set(rule.id, rule); }, remove: (id: string) => { rows.delete(id); } };
}
const fileRule = { name: 'run-tests', trigger: { kind: 'event' as const, event: 'file.changed', path: 'src/**/*.ts' }, task: 'Testleri koş', agentId: 'hafize-general' };
const cronRule = { name: 'daily-summary', trigger: { kind: 'cron' as const, expression: '0 9 * * *' }, task: 'Özet çıkar', agentId: 'hafize-general' };

describe('rule persistence', () => {
  it('survives a restart with its trigger, enabled state and fire history', async () => {
    const store = memoryStore();
    const first = createRuleEngine({ store, run: async () => {} });
    const cron = first.create('u1', cronRule);
    const file = first.create('u1', fileRule);
    first.setEnabled('u1', cron.id, false);
    await first.emit('file.changed', { path: 'src/a.ts' });

    const runs: string[] = [];
    const restarted = createRuleEngine({ store, run: async ({ rule }) => { runs.push(rule.name); } });
    expect(restarted.size()).toBe(2);
    expect(restarted.list('u1').find((rule) => rule.id === cron.id)?.enabled).toBe(false);
    expect(restarted.list('u1').find((rule) => rule.id === file.id)?.fireCount).toBe(1);
    // Cron rules are compiled again on load, so they can still fire after a restart.
    restarted.setEnabled('u1', cron.id, true);
    await restarted.tick(new Date(2026, 0, 1, 9, 0, 0));
    expect(runs).toEqual(['daily-summary']);
  });

  it('forgets removed rules and skips a damaged one without losing the rest', () => {
    const store = memoryStore();
    const first = createRuleEngine({ store, run: async () => {} });
    const gone = first.create('u1', cronRule);
    const kept = first.create('u1', fileRule);
    first.remove('u1', gone.id);
    expect(store.rows.has(gone.id)).toBe(false);
    store.rows.set('broken', { ...kept, id: 'broken', trigger: { kind: 'cron', expression: 'bozuk' } } as Rule);
    expect(createRuleEngine({ store, run: async () => {} }).list('u1').map((rule) => rule.id)).toEqual([kept.id]);
  });
});

describe('file rules', () => {
  const engine = () => { const runs: unknown[] = []; return { runs, instance: createRuleEngine({ run: async ({ payload }) => { runs.push(payload); } }) }; };

  it('fires only for paths matching the rule, and for every path without a pattern', async () => {
    const { instance, runs } = engine();
    instance.create('u1', fileRule);
    await instance.emit('file.changed', { path: 'docs/readme.md' });
    expect(runs).toHaveLength(0);
    await instance.emit('file.changed', { path: 'src/lib/a.ts' });
    expect(runs).toHaveLength(1);
    const open = engine();
    open.instance.create('u1', { ...fileRule, trigger: { kind: 'event', event: 'file.changed' } });
    await open.instance.emit('file.changed', { path: 'docs/readme.md' });
    expect(open.runs).toHaveLength(1);
  });

  it('rejects patterns that try to leave the workspace', () => {
    const { instance } = engine();
    for (const path of ['../secret', '/etc/passwd', 'a/../../b']) {
      expect(() => instance.create('u1', { ...fileRule, trigger: { kind: 'event', event: 'file.changed', path } })).toThrow('INVALID_RULE_PATH');
    }
  });
});

describe('workspace watcher', () => {
  it('normalizes paths and ignores tool output folders', () => {
    expect(normalizeWatchedPath('src\\a.ts')).toBe('src/a.ts');
    expect(normalizeWatchedPath('./notes.txt')).toBe('notes.txt');
    expect(normalizeWatchedPath('node_modules/x/y.js')).toBeNull();
    expect(normalizeWatchedPath('.git/index')).toBeNull();
    expect(normalizeWatchedPath('../outside.txt')).toBeNull();
    expect(normalizeWatchedPath('')).toBeNull();
    expect(normalizeWatchedPath(null)).toBeNull();
  });

  it('reports one change per path however often it is touched', () => {
    vi.useFakeTimers();
    try {
      const changes: string[] = [];
      const watcher = createWorkspaceWatcher({ dir: 'unused', onChange: (path) => { changes.push(path); }, debounceMs: 100 });
      watcher.notice('a.txt'); watcher.notice('a.txt'); watcher.notice('b.txt'); watcher.notice('.git/x');
      vi.advanceTimersByTime(99);
      watcher.notice('a.txt');
      vi.advanceTimersByTime(100);
      expect(changes.sort()).toEqual(['a.txt', 'b.txt']);
      watcher.stop();
    } finally { vi.useRealTimers(); }
  });

  it('sees a real file written into the folder', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-watch-'));
    mkdirSync(join(dir, 'src'));
    const seen = new Promise<string>((resolve) => {
      const watcher = createWorkspaceWatcher({ dir, debounceMs: 20, onChange: (path) => { watcher.stop(); resolve(path); } });
      expect(watcher.start()).toBe(true);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    writeFileSync(join(dir, 'src', 'a.ts'), 'x');
    await expect(Promise.race([seen, new Promise((_, reject) => setTimeout(() => reject(new Error('no change seen')), 4000))])).resolves.toBe('src/a.ts');
  });
});

describe('task results', () => {
  const make = () => {
    const db = openHafizeDb(':memory:');
    const crypto = createEnvelopeCrypto({ db, masterKey: randomBytes(32) });
    let clock = 1_000;
    return { db, results: createTaskResults({ db, cipherFor: (owner) => crypto.forOwner(owner), now: () => (clock += 1) }) };
  };

  it('keeps answers encrypted, per owner, newest first', () => {
    const { db, results } = make();
    results.record({ ownerId: 'u1', task: 'Gizli görev', ok: true, content: 'Gizli yanıt' });
    results.record({ ownerId: 'u1', task: 'İkinci', ok: false, error: 'SCHEDULE_AGENT_RUN_FAILED' });
    results.record({ ownerId: 'u2', task: 'Başkası', ok: true, content: 'x' });
    const list = results.list('u1');
    expect(list.map((item) => item.task)).toEqual(['İkinci', 'Gizli görev']);
    expect(list[1]).toMatchObject({ ok: true, content: 'Gizli yanıt', readAt: null });
    expect(list[0]).toMatchObject({ ok: false, error: 'SCHEDULE_AGENT_RUN_FAILED' });
    const raw = JSON.stringify(db.prepare('SELECT * FROM task_results').all());
    expect(raw).not.toContain('Gizli');
  });

  it('marks read and deletes only for the owner, and limits history', () => {
    const { results } = make();
    const id = results.record({ ownerId: 'u1', task: 't', ok: true, content: 'c' })!;
    expect(results.markRead('u2', id)).toBe(0);
    expect(results.remove('u2', id)).toBe(false);
    expect(results.markRead('u1', id)).toBe(1);
    expect(results.list('u1')[0]?.readAt).not.toBeNull();
    expect(results.remove('u1', id)).toBe(true);
    for (let i = 0; i < 105; i += 1) results.record({ ownerId: 'u1', task: `t${i}`, ok: true, content: '' });
    expect(results.list('u1', { limit: 100 })).toHaveLength(100);
    expect(results.list('u1', { limit: 1 })[0]?.task).toBe('t104');
  });

  it('ignores a result with no owner', () => {
    expect(make().results.record({ ownerId: '', task: 't', ok: true })).toBeNull();
  });
});
