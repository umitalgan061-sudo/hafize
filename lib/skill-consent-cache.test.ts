import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSkillAuditLog } from './skill-audit.ts';
import { createSkillConsentRuntime } from './skill-consent-runtime.ts';
import { createIdempotencyStore } from './skill-idempotency.ts';
import { createSkillsRuntime } from './skills-runtime.ts';

const riskySkill = {
  name: 'risky-note',
  description: 'Test için yüksek riskli skill.',
  triggers: ['riskli not'],
  allowedTools: ['runtime.status'],
  arguments: [{ name: 'text', required: true, description: 'Not.' }],
  requiredScopes: ['runtime.status'],
  sideEffects: { idempotent: true, mutates: true, external: false },
  riskLevel: 'high',
  rollbackHint: 'Notu sil.',
  execution: 'inline',
  prompt: 'Test.'
};
const agent = { id: 'tester', name: 'Tester', description: 'test', toolPolicy: { default: 'deny', allow: ['skill.invoke', 'runtime.status'], deny: [], approvalRequired: [] } };

describe('skill consent with the idempotency cache', () => {
  it('re-checks consent on every call, so a revoked consent is not bypassed by a cached result', async () => {
    const consentRuntime = createSkillConsentRuntime({ filePath: join(mkdtempSync(join(tmpdir(), 'hafize-consent-')), 'consents.json') });
    const runtime = await createSkillsRuntime({
      readFileImpl: async () => JSON.stringify([riskySkill]),
      auditLog: createSkillAuditLog(),
      consentRuntime,
      idempotencyStore: createIdempotencyStore()
    });
    const call = () => runtime.resolveForAgent({ agent, skillId: 'risky-note', args: { text: 'merhaba' }, ownerId: 'owner-1', sessionId: 'session-1' });

    expect(() => call()).toThrow('SKILL_CONSENT_REQUIRED');
    consentRuntime.grant({ ownerId: 'owner-1', sessionId: 'session-1', skillId: 'risky-note', scopes: ['runtime.status'], mode: 'session' });
    expect(call()).toMatchObject({ name: 'risky-note' });
    consentRuntime.revoke({ ownerId: 'owner-1', skillId: 'risky-note', scope: 'runtime.status' });
    expect(() => call()).toThrow(/SKILL_CONSENT_(REQUIRED|DENIED)/);
  });
});
