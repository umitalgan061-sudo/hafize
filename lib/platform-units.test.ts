import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openHafizeDb } from './hafize-db.ts';
import { createApprovalGate } from './approval-gate.ts';
import { createActionJournal } from './action-journal.ts';
import { createTelemetry, percentile } from './telemetry.ts';
import { createEnvelopeCrypto, loadMasterKey } from './envelope-crypto.ts';
import { createExpertRegistry, validateJsonSchema } from './expert-registry.ts';
import { createLocalTools } from './local-tools.ts';
import { createPromptRegistry } from './prompt-registry.ts';
import { parseModelJson } from './model-services.ts';
import { loadAgentRegistry } from './agent-runtime.ts';

describe('approval gate', () => {
  it('resolves only for the owner and denies on timeout or abort', async () => {
    const gate = createApprovalGate({ timeoutMs: 50 });
    const first = gate.request({ ownerId: 'u1', traceId: 't', kind: 'shell.run', title: 'x', detail: 'y', risk: 'high' });
    expect(gate.resolve(first.id, 'someone-else', { approved: true })).toBe(false);
    expect(gate.resolve(first.id, 'u1', { approved: true, mode: 'session' })).toBe(true);
    await expect(first.decision).resolves.toMatchObject({ approved: true, mode: 'session', reason: 'user' });
    const timed = gate.request({ ownerId: 'u1', traceId: 't', kind: 'k', title: 'x', detail: 'y', risk: 'high' });
    await expect(timed.decision).resolves.toMatchObject({ approved: false, reason: 'timeout' });
    const controller = new AbortController();
    const aborted = gate.request({ ownerId: 'u1', traceId: 't', kind: 'k', title: 'x', detail: 'y', risk: 'high' }, controller.signal);
    controller.abort();
    await expect(aborted.decision).resolves.toMatchObject({ approved: false, reason: 'aborted' });
    const never = gate.request({ ownerId: 'u1', traceId: 't', kind: 'k', title: 'x', detail: 'y', risk: 'high', modes: ['never'] });
    gate.resolve(never.id, 'u1', { approved: true, mode: 'never' });
    await expect(never.decision).resolves.toMatchObject({ approved: false });
  });
});

describe('action journal', () => {
  it('undoes once, per owner, and restores the row when the compensation fails', async () => {
    const journal = createActionJournal({ db: openHafizeDb(':memory:') });
    const calls: unknown[] = [];
    let fail = true;
    journal.registerCompensator('test', async (payload) => {
      if (fail) { fail = false; throw new Error('boom'); }
      calls.push(payload);
      return { ok: true };
    });
    const id = journal.record({ ownerId: 'u1', traceId: 't', tool: 'x', summary: 'deneme', compensation: { type: 'test', payload: { a: 1 } } });
    await expect(journal.undo(id, 'u2')).rejects.toThrow('ACTION_NOT_FOUND');
    await expect(journal.undo(id, 'u1')).rejects.toThrow('boom');
    await expect(journal.undo(id, 'u1')).resolves.toMatchObject({ undone: true });
    await expect(journal.undo(id, 'u1')).rejects.toThrow('ACTION_ALREADY_UNDONE');
    expect(calls).toEqual([{ a: 1 }]);
    expect(() => journal.record({ ownerId: 'u1', traceId: 't', tool: 'x', summary: 's', compensation: { type: 'unknown', payload: {} } })).toThrow('UNKNOWN_COMPENSATION');
  });
});

describe('telemetry', () => {
  it('summarizes spans, usage and feedback and exports Prometheus and OTLP', async () => {
    let clock = 1_000_000;
    const exported: unknown[] = [];
    const telemetry = createTelemetry({
      db: openHafizeDb(':memory:'), now: () => clock, otlpEndpoint: 'http://collector:4318',
      fetchImpl: (async (_url: string, init: RequestInit) => { exported.push(JSON.parse(String(init.body))); return new Response('{}'); }) as unknown as typeof fetch
    });
    for (const duration of [100, 200, 300]) {
      const span = telemetry.startSpan('tool.call', { traceId: '7d3f0d2a-8b1c-4c55-9e5a-0a1b2c3d4e5f', attributes: { 'tool.name': 'web_search' } });
      clock += duration;
      span.end(duration === 300 ? 'error' : 'ok');
    }
    telemetry.recordUsage({ traceId: 't', model: 'm', purpose: 'agent.round', promptTokens: 100, completionTokens: 20 });
    telemetry.recordFeedback({ ownerId: 'u', messageId: 'a', rating: 'up', promptVariant: 'A' });
    telemetry.recordFeedback({ ownerId: 'u', messageId: 'b', rating: 'down', promptVariant: 'B' });
    const summary = telemetry.summary();
    expect(summary.operations[0]).toMatchObject({ name: 'tool.call', count: 3, p50Ms: 200, p99Ms: 300 });
    expect(summary.tools[0]).toMatchObject({ name: 'web_search', ok: 2, error: 1 });
    expect(summary.tokens.total).toBe(120);
    expect(summary.feedback).toMatchObject({ up: 1, down: 1, satisfaction: 0.5 });
    expect(telemetry.prometheus()).toContain('hafize_tool_success_ratio{tool="web_search"} 0.6667');
    await telemetry.flush();
    const spans = (exported[0] as { resourceSpans: Array<{ scopeSpans: Array<{ spans: Array<{ traceId: string; status: { code: number } }> }> }> }).resourceSpans[0]!.scopeSpans[0]!.spans;
    expect(spans).toHaveLength(3);
    expect(spans[0]!.traceId).toBe('7d3f0d2a8b1c4c559e5a0a1b2c3d4e5f');
    expect(spans[2]!.status.code).toBe(2);
    expect(percentile([], 50)).toBe(0);
  });
});

describe('envelope crypto', () => {
  it('generates, reloads and isolates owner keys', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-key-'));
    const generated = loadMasterKey({ keyFile: join(dir, 'master.key') });
    expect(generated.source).toBe('generated');
    expect(loadMasterKey({ keyFile: join(dir, 'master.key') }).key.equals(generated.key)).toBe(true);
    expect(() => loadMasterKey({ envValue: 'kısa', keyFile: join(dir, 'x') })).toThrow('INVALID_MASTER_KEY');
    const db = openHafizeDb(':memory:');
    const crypto = createEnvelopeCrypto({ db, masterKey: generated.key });
    const sealed = crypto.forOwner('u1').encrypt('gizli not');
    expect(crypto.forOwner('u1').decrypt(sealed)).toBe('gizli not');
    expect(() => crypto.forOwner('u2').decrypt(sealed)).toThrow('DECRYPTION_FAILED');
    expect(() => createEnvelopeCrypto({ db, masterKey: randomBytes(32) }).forOwner('u1').decrypt(sealed)).toThrow('DECRYPTION_FAILED');
    expect(crypto.forOwner('u1').tokenHash('ankara')).not.toBe(crypto.forOwner('u2').tokenHash('ankara'));
  });
});

describe('expert registry', () => {
  it('ranks experts by capability, enforces quota and validates output schemas', async () => {
    const registry = await loadAgentRegistry();
    const experts = createExpertRegistry({ registry, db: openHafizeDb(':memory:') });
    expect(experts.resolve('olasılık ve denklem hesabı')[0]?.agentId).toBe('expert-math');
    expect(experts.resolve('kira sözleşmesi hukuk')[0]?.agentId).toBe('expert-legal-tr');
    expect(experts.validateOutput('expert-researcher', 'düz metin').ok).toBe(false);
    expect(experts.validateOutput('expert-researcher', '{"summary":"x","sources":["https://a"]}').ok).toBe(true);
    expect(experts.validateOutput('expert-math', '13/28').ok).toBe(true);
    for (let index = 0; index < 200; index += 1) expect(experts.consumeCall('expert-math')).toBe(true);
    expect(experts.consumeCall('expert-math')).toBe(false);
    expect(experts.healthCheck('expert-math').reasons).toContain('günlük kota doldu');
    experts.audit({ parentTraceId: 't', childAgentId: 'expert-writer', task: 'görev', result: 'sonuç', latencyMs: 1200, ok: true });
    expect(experts.delegationLog()[0]).toMatchObject({ childAgentId: 'expert-writer', latencyMs: 1200 });
    expect(validateJsonSchema({ a: [1, 'x'] }, { type: 'object', properties: { a: { type: 'array', items: { type: 'number' } } }, required: ['a'] })).toEqual(['$.a[1]: number bekleniyordu']);
  });
});

describe('local tools', () => {
  it('stays inside the workspace, undoes writes and gates SQL writes and shell commands', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-ws-'));
    const tools = createLocalTools({ workspaceDir: dir });
    expect(() => tools.read({ path: '../dışarı.txt' })).toThrow('WORKSPACE_TRAVERSAL');
    expect(() => tools.read({ path: 'C:/Windows/win.ini' })).toThrow('INVALID_WORKSPACE_PATH');
    const first = tools.write({ path: 'notlar/a.md', content: 'bir' });
    expect(first.result.created).toBe(true);
    const second = tools.write({ path: 'notlar/a.md', content: 'iki' });
    tools.restore(second.undo as unknown as Record<string, unknown>);
    expect(readFileSync(join(dir, 'notlar', 'a.md'), 'utf8')).toBe('bir');
    tools.restore(first.undo as unknown as Record<string, unknown>);
    expect(existsSync(join(dir, 'notlar', 'a.md'))).toBe(false);
    expect(() => tools.write({ path: 'x.md', content: 'password: hunter2hunter2' })).toThrow('WORKSPACE_SECRET_BLOCKED');
    expect(tools.list({}).entries.map((entry) => entry.name)).toContain('notlar');

    const { DatabaseSync } = await import('node:sqlite');
    const file = new DatabaseSync(join(dir, 'veri.db'));
    file.exec("CREATE TABLE t (ad TEXT); INSERT INTO t VALUES ('a'), ('b');");
    file.close();
    await expect(tools.sqlite({ path: 'veri.db', sql: 'SELECT COUNT(*) AS n FROM t' })).resolves.toMatchObject({ rows: [{ n: 2 }] });
    await expect(tools.sqlite({ path: 'veri.db', sql: "DELETE FROM t" })).rejects.toThrow('SQLITE_WRITE_NEEDS_APPROVAL');
    await expect(tools.sqlite({ path: 'veri.db', sql: "DELETE FROM t" }, async () => false)).rejects.toThrow('APPROVAL_DENIED');
    await expect(tools.sqlite({ path: 'veri.db', sql: "SELECT 1; DELETE FROM t" }, async () => false)).rejects.toThrow('APPROVAL_DENIED');
    await expect(tools.sqlite({ path: 'veri.db', sql: "DELETE FROM t WHERE ad = ?", params: ['a'] }, async () => true)).resolves.toMatchObject({ changes: 1 });

    await expect(tools.shell({ command: 'echo merhaba' })).rejects.toThrow('SHELL_NEEDS_APPROVAL');
    await expect(tools.shell({ command: 'echo merhaba' }, async () => false)).rejects.toThrow('APPROVAL_DENIED');
    process.env.HAFIZE_TEST_SECRET_TOKEN = 'sızmamalı';
    const run = await tools.shell({ command: process.platform === 'win32' ? 'Write-Output "merhaba"; Write-Output "$env:HAFIZE_TEST_SECRET_TOKEN"' : 'echo merhaba; echo "$HAFIZE_TEST_SECRET_TOKEN"' }, async () => true);
    expect(run.stdout).toContain('merhaba');
    expect(run.stdout).not.toContain('sızmamalı');
  }, 60_000);
});

describe('prompt registry and model JSON', () => {
  it('assigns a stable A/B variant and parses fenced or chatty JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-prompts-'));
    writeFileSync(join(dir, 'a.md'), 'A metni');
    writeFileSync(join(dir, 'b.md'), 'B metni');
    writeFileSync(join(dir, 'registry.json'), JSON.stringify({ prompts: [{ id: 'p', active: '1.0.0', versions: [{ version: '1.0.0', file: 'a.md' }, { version: '1.1.0', file: 'b.md' }], experiment: { enabled: true, variants: [{ name: 'A', version: '1.0.0', weight: 1 }, { name: 'B', version: '1.1.0', weight: 1 }] } }] }));
    const prompts = createPromptRegistry({ dir });
    const seen = new Set(Array.from({ length: 40 }, (_, index) => prompts.assign('p', `c${index}`)!.variant));
    expect(seen).toEqual(new Set(['A', 'B']));
    expect(prompts.assign('p', 'c1')).toEqual(prompts.assign('p', 'c1'));
    expect(prompts.assign('yok', 'c1')).toBeNull();
    expect(parseModelJson('Tabii! ```json\n{"a": [1, "}"]}\n``` umarım işine yarar')).toEqual({ a: [1, '}'] });
    expect(parseModelJson('Önce düşündüm. {"ok": true} bitti')).toEqual({ ok: true });
    expect(() => parseModelJson('json yok')).toThrow('MODEL_JSON_INVALID');
  });
});
