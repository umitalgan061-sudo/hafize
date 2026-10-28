import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSkillAuthoringService, nextVersion } from './skill-authoring.ts';
import { createSkillsRegistry } from './skills-registry.ts';
import { createSandboxRunner } from './sandbox-runner.ts';

const sandbox = createSandboxRunner();

function service(dir: string, allowed: readonly string[] = ['notes.write', 'web.read']) {
  const registry = createSkillsRegistry();
  return createSkillAuthoringService({
    register: (manifest) => registry.register(manifest, { source: 'user' }),
    unregister: (name) => registry.unregister(name),
    has: (name) => Boolean(registry.get(name)),
    userSkillsDir: dir,
    sandbox,
    authorizeTool: (tool) => ({ allowed: allowed.includes(tool) })
  });
}

const baseManifest = {
  name: 'standup-note',
  description: 'GÃ¼nlÃ¼k durum notunu standart biÃ§imde yazar.',
  triggers: ['standup', 'durum'],
  allowedTools: ['notes.write'],
  parameters: { type: 'object', properties: { done: { type: 'string' }, next: { type: 'string' } }, required: ['done'], additionalProperties: false },
  prompt: 'Verilen bilgilerle kÄ±sa bir standup notu yaz.'
};

describe('skill authoring', () => {
  it('bumps versions', () => {
    expect(nextVersion(null)).toBe('1.0.0');
    expect(nextVersion('1.2.3')).toBe('1.2.4');
    expect(nextVersion('1.2.3', 'minor')).toBe('1.3.0');
    expect(nextVersion('1.2.3', 'major')).toBe('2.0.0');
  });

  it('writes a manifest, registers it and makes it invocable', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-author-'));
    const created = await service(dir).create({ manifest: baseManifest });
    expect(created).toMatchObject({ created: true, name: 'standup-note', version: '1.0.0' });
    expect(existsSync(join(dir, 'standup-note.json'))).toBe(true);
    // The manifest stays schema-clean; the version lives in the sidecar meta file.
    const onDisk = JSON.parse(readFileSync(join(dir, 'standup-note.json'), 'utf8'));
    expect(onDisk.version).toBeUndefined();
    const meta = JSON.parse(readFileSync(join(dir, 'standup-note.meta.json'), 'utf8'));
    expect(meta.version).toBe('1.0.0');
  });

  it('refuses a tool the agent does not already have', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-author-'));
    await expect(service(dir, ['notes.write']).create({ manifest: { ...baseManifest, allowedTools: ['repo.write_branch'], execution: 'fork' } }))
      .rejects.toMatchObject({ code: 'SKILL_TOOL_ESCALATION:repo.write_branch' });
  });

  it('rejects an invalid manifest through the shared normalizer', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-author-'));
    await expect(service(dir).create({ manifest: { ...baseManifest, name: 'Bad Name' } }))
      .rejects.toMatchObject({ code: 'INVALID_SKILL_NAME' });
    await expect(service(dir).create({ manifest: { ...baseManifest, prompt: '' } }))
      .rejects.toMatchObject({ code: 'INVALID_SKILL_PROMPT' });
  });

  it('refuses secrets in sandbox code', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-author-'));
    await expect(service(dir).create({
      manifest: { ...baseManifest, handler: { type: 'sandbox', file: 'hook.js' } },
      code: 'const k = "nvapi-abcdefghijklmnopqrstuvwxyz012345"; return { ok: true };'
    })).rejects.toMatchObject({ code: 'SKILL_CODE_SECRET_MATERIAL' });
  });

  it('refuses node built-ins in sandbox code', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-author-'));
    await expect(service(dir).create({
      manifest: { ...baseManifest, handler: { type: 'sandbox', file: 'hook.js' } },
      code: 'const fs = require("node:fs"); return {};'
    })).rejects.toMatchObject({ code: 'SKILL_CODE_FORBIDDEN_API' });
  });

  it('refuses code without a sandbox handler', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-author-'));
    await expect(service(dir).create({ manifest: baseManifest, code: 'return 1;' }))
      .rejects.toMatchObject({ code: 'SKILL_CODE_WITHOUT_HANDLER' });
  });

  it('health-checks sandbox code before registering it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-author-'));
    await expect(service(dir).create({
      manifest: { ...baseManifest, handler: { type: 'sandbox', file: 'hook.js' } },
      code: 'throw new Error("boom");',
      healthCheck: { done: 'x' }
    })).rejects.toMatchObject({ code: 'SKILL_HEALTH_CHECK_FAILED' });
    expect(existsSync(join(dir, 'hook.js'))).toBe(false);
    expect(existsSync(join(dir, 'standup-note.json'))).toBe(false);
  });

  it('registers a working sandbox skill and bumps the version on update', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-author-'));
    const code = 'const text = `done: ${input.args.done}`; return { note: text };';
    const first = await service(dir).create({
      manifest: { ...baseManifest, handler: { type: 'sandbox', file: 'standup.js' }, returns: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] } },
      code,
      healthCheck: { done: 'a' }
    });
    expect(first.version).toBe('1.0.0');
    expect(existsSync(join(dir, 'standup.js'))).toBe(true);
    const second = await service(dir).create({
      manifest: { ...baseManifest, handler: { type: 'sandbox', file: 'standup.js' }, returns: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] } },
      code,
      healthCheck: { done: 'a' }
    });
    expect(second.version).toBe('1.0.1');
  });

  it('restores the previous files when a later step fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hafize-author-'));
    // One service instance (one registry) so the second create() is seen as an update.
    const svc = service(dir);
    const good = 'return { note: "ok" };';
    const manifestWithHandler = { ...baseManifest, handler: { type: 'sandbox', file: 'standup.js' }, returns: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] } };
    await svc.create({ manifest: manifestWithHandler, code: good, healthCheck: { done: 'a' } });
    const before = readFileSync(join(dir, 'standup-note.json'), 'utf8');
    await expect(svc.create({ manifest: manifestWithHandler, code: 'throw new Error("broken");', healthCheck: { done: 'a' } }))
      .rejects.toMatchObject({ code: 'SKILL_HEALTH_CHECK_FAILED' });
    expect(readFileSync(join(dir, 'standup-note.json'), 'utf8')).toBe(before);
    expect(readFileSync(join(dir, 'standup.js'), 'utf8')).toBe(good);
  });
});