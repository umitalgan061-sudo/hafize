import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSandboxRunner } from './sandbox-runner.ts';
import { createSkillExecutor, registerUserSkills } from './skill-executor.ts';
import { createSkillsRuntime } from './skills-runtime.ts';
import { createSkillAuditLog } from './skill-audit.ts';
import { createSkillConsentRuntime } from './skill-consent-runtime.ts';
import { defineSkill, packSkill, testSkill } from './skill-sdk.ts';
import { generateSigningKeys, installBundle, installedVersion, signBundle, verifyBundle } from './skill-bundles.ts';
import { openHafizeDb } from './hafize-db.ts';
import { createActionJournal } from './action-journal.ts';

const sandbox = createSandboxRunner();
const agent = { id: 'tester', name: 'Tester', description: 'test', toolPolicy: { default: 'deny', allow: ['skill.invoke', 'calc.run', 'notes.write'], deny: [], approvalRequired: [] } };
const baseManifest = {
  name: 'sum-numbers',
  description: 'Sayıları toplar.',
  triggers: ['topla'],
  allowedTools: ['calc.run'],
  parameters: { type: 'object', properties: { values: { type: 'array', items: { type: 'number' } } }, required: ['values'], additionalProperties: false },
  returns: { type: 'object', properties: { total: { type: 'number' } }, required: ['total'] },
  prompt: 'Sayıları topla.'
};

async function runtimeWith(dir: string, extraBuiltin: unknown[] = []) {
  const runtime = await createSkillsRuntime({
    readFileImpl: async () => JSON.stringify([{ name: 'noop', description: 'x', triggers: ['x'], allowedTools: ['calc.run'], prompt: 'x' }, ...extraBuiltin]),
    auditLog: createSkillAuditLog(),
    consentRuntime: createSkillConsentRuntime({ filePath: join(dir, 'consents.json') })
  });
  return runtime;
}

describe('skill SDK', () => {
  it('turns a handler function into sandbox code and checks the return schema', async () => {
    const skill = defineSkill(baseManifest, ({ args }) => ({ total: (args.values as number[]).reduce((a, b) => a + b, 0) }));
    const ok = await testSkill(skill, { values: [1, 2, 3] }, sandbox);
    expect(ok).toMatchObject({ ok: true, result: { total: 6 } });
    const bad = await testSkill(defineSkill(baseManifest, () => ({ sum: 1 })), { values: [] }, sandbox);
    expect(bad.ok).toBe(false);
    expect(bad.schemaErrors[0]).toContain('total');
  });
});

describe('skill executor', () => {
  it('runs a user skill in the sandbox, audits it and replays idempotent calls', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-skills-'));
    const skill = defineSkill(baseManifest, ({ args }) => ({ total: (args.values as number[]).reduce((a, b) => a + b, 0) }));
    writeFileSync(join(dir, 'sum-numbers.json'), JSON.stringify(skill.manifest));
    writeFileSync(join(dir, 'sum-numbers.js'), skill.code);
    writeFileSync(join(dir, 'broken.json'), '{"name":"Bad Name"}');
    const runtime = await runtimeWith(dir);
    const loaded = registerUserSkills(runtime as never, dir);
    expect(loaded.loaded).toEqual(['sum-numbers']);
    expect(loaded.errors).toHaveLength(1);
    const executor = createSkillExecutor({ skillsRuntime: runtime as never, sandbox, invokeTool: async () => ({ ok: false }), userSkillsDir: dir });
    const first = await executor.invoke({ agent, skillId: 'sum-numbers', args: { values: [2, 3] }, traceId: 't', ownerId: 'u' });
    expect(first).toMatchObject({ kind: 'result', result: { total: 5 } });
    const second = await executor.invoke({ agent, skillId: 'sum-numbers', args: { values: [2, 3] }, traceId: 't', ownerId: 'u' });
    expect(second.idempotentReplay).toBe(true);
    await expect(executor.invoke({ agent, skillId: 'sum-numbers', args: { values: 'x' }, traceId: 't', ownerId: 'u' })).rejects.toThrow('INVALID_SKILL_PARAMETERS');
  });

  it('asks for consent inline for risky skills and records an undo action', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-skills-'));
    const risky = {
      name: 'note-writer', description: 'Not yazar.', triggers: ['not yaz'], allowedTools: ['notes.write'], requiredScopes: ['notes.write'],
      sideEffects: { idempotent: false, mutates: true, external: false }, riskLevel: 'medium',
      arguments: [{ name: 'text', required: true }],
      handler: { type: 'tool', tool: 'note_write' }, compensate: { type: 'tool', tool: 'note_delete' }, prompt: 'Not yaz.'
    };
    const runtime = await runtimeWith(dir, [risky]);
    const db = openHafizeDb(':memory:');
    const journal = createActionJournal({ db });
    const calls: string[] = [];
    const executor = createSkillExecutor({
      skillsRuntime: runtime as never, sandbox, journal, userSkillsDir: dir,
      invokeTool: async (tool, args) => { calls.push(`${tool}:${JSON.stringify(args)}`); return { ok: true, value: { done: tool } }; }
    });
    await expect(executor.invoke({ agent, skillId: 'note-writer', args: { text: 'a' }, traceId: 't', ownerId: 'u', sessionId: 's' })).rejects.toThrow('SKILL_CONSENT_REQUIRED');
    const prompts: string[] = [];
    const result = await executor.invoke({
      agent, skillId: 'note-writer', args: { text: 'merhaba' }, traceId: 't', ownerId: 'u', sessionId: 's',
      approveConsent: async (request) => { prompts.push(request.skillId); return { approved: true, mode: 'session' }; }
    });
    expect(prompts).toEqual(['note-writer']);
    expect(result).toMatchObject({ kind: 'result', result: { done: 'note_write' } });
    expect(typeof result.actionId).toBe('string');
    await journal.undo(String(result.actionId), 'u');
    expect(calls).toEqual(['note_write:{"text":"merhaba"}', 'note_delete:{"text":"merhaba"}']);
    // Session consent now covers the next call without asking again.
    await executor.invoke({ agent, skillId: 'note-writer', args: { text: 'iki' }, traceId: 't', ownerId: 'u', sessionId: 's' });
  });
});

describe('signed skill bundles', () => {
  it('installs verified bundles, rejects tampering and rolls back failed health checks', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-bundles-'));
    const keys = generateSigningKeys();
    const trusted = new Map([[keys.keyId, keys.publicKeyPem]]);
    const good = signBundle(packSkill(defineSkill(baseManifest, ({ args }) => ({ total: (args.values as number[] || []).length })), '1.0.0', { values: [1] }), keys.privateKeyPem);
    expect(verifyBundle(good, trusted).name).toBe('sum-numbers');
    expect(() => verifyBundle({ ...good, code: 'return 1' }, trusted)).toThrow('BUNDLE_SIGNATURE_INVALID');
    expect(() => verifyBundle(good, new Map())).toThrow('BUNDLE_SIGNER_NOT_TRUSTED');

    await installBundle({ raw: good, trustedKeys: trusted, dir, sandbox });
    expect(installedVersion(dir, 'sum-numbers')).toBe('1.0.0');
    await expect(installBundle({ raw: good, trustedKeys: trusted, dir, sandbox })).rejects.toThrow('BUNDLE_NOT_NEWER');

    const broken = signBundle(packSkill(defineSkill(baseManifest, 'throw new Error("boom")'), '1.1.0'), keys.privateKeyPem);
    await expect(installBundle({ raw: broken, trustedKeys: trusted, dir, sandbox })).rejects.toThrow('BUNDLE_HEALTH_CHECK_FAILED');
    expect(installedVersion(dir, 'sum-numbers')).toBe('1.0.0');
    expect(readFileSync(join(dir, 'sum-numbers.js'), 'utf8')).not.toContain('boom');
    expect(existsSync(join(dir, 'sum-numbers.json'))).toBe(true);
  });
});
