import { mkdtempSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadAgentRegistry } from './agent-runtime.ts';
import { createBuiltinSkillsRuntimeSync } from './skills-runtime.ts';
import { createSkillAuditLog } from './skill-audit.ts';
import { createSkillConsentRuntime } from './skill-consent-runtime.ts';
import { executeNvidiaToolCall, getAllowedNvidiaTools } from './tool-runtime.ts';
import { createHafizePlatform, type HafizePlatform } from './hafize-platform.ts';

let platform: HafizePlatform;
let server: Server;
let base = '';
const scheduled: Array<{ ownerId: string; agentId: string; task: string }> = [];

beforeAll(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'hafize-rules-'));
  platform = createHafizePlatform({
    root: fileURLToPath(new URL('../', import.meta.url)),
    env: { HAFIZE_DATA_DIR: dataDir, HAFIZE_WORKSPACE_DIR: join(dataDir, 'ws') },
    apiKey: '',
    nimBaseUrl: 'http://127.0.0.1:9',
    chat: async () => ({ choices: [{ message: { content: '{}' } }] }),
    webTools: { search: async () => ({ results: [] }), wikipedia: async () => ({}), news: async () => ({ items: [] }), rates: async () => ({}), readPage: async () => ({}) } as never,
    registry: await loadAgentRegistry(),
    skillsRuntime: createBuiltinSkillsRuntimeSync({ auditLog: createSkillAuditLog(), consentRuntime: createSkillConsentRuntime({ filePath: join(dataDir, 'consents.json') }) }),
    executeTool: executeNvidiaToolCall as never,
    allowedTools: getAllowedNvidiaTools as never,
    scheduleRuleTask: async (input) => { scheduled.push(input); }
  });
  server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const owner = req.headers['x-test-owner'];
    if (typeof owner === 'string') Object.defineProperty(req, '__hafizePrincipal', { value: { ownerId: owner, sessionId: 's' } });
    if (!(await platform.handle(req, res, url))) { res.statusCode = 404; res.end('{}'); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await platform.shutdown();
});

const call = (path: string, init: RequestInit & { owner?: string } = {}) => fetch(`${base}${path}`, {
  ...init,
  headers: { 'Content-Type': 'application/json', ...(init.owner === undefined ? { 'X-Test-Owner': 'u1' } : init.owner ? { 'X-Test-Owner': init.owner } : {}), ...(init.headers as Record<string, string> || {}) }
});

describe('rule tools through the platform', () => {
  it('creates, lists, disables and removes a rule for the owner', async () => {
    // Rule creation is driven through the engine the platform owns, mirroring the tool service.
    const rule = platform.ruleEngine.create('u1', {
      name: 'nightly-tests',
      description: 'Gece testleri',
      trigger: { kind: 'cron', expression: '0 3 * * *' },
      task: 'Testleri koş ve özet çıkar.',
      agentId: 'agency-minimal-engineer'
    });
    expect(rule).toMatchObject({ name: 'nightly-tests', enabled: true, ownerId: 'u1' });
    expect(platform.ruleEngine.list('u1').map((item) => item.name)).toContain('nightly-tests');

    // Owner isolation: another owner sees nothing and cannot touch this rule.
    expect(platform.ruleEngine.list('u2')).toHaveLength(0);
    expect(() => platform.ruleEngine.remove('u2', rule.id)).toThrow('RULE_NOT_FOUND');

    const disabled = platform.ruleEngine.setEnabled('u1', rule.id, false);
    expect(disabled.enabled).toBe(false);
    const enabled = platform.ruleEngine.setEnabled('u1', rule.id, true);
    expect(enabled.enabled).toBe(true);

    expect(platform.ruleEngine.remove('u1', rule.id)).toMatchObject({ name: 'nightly-tests' });
    expect(platform.ruleEngine.list('u1')).toHaveLength(0);
  });

  it('schedules a task through the injected runner when a cron rule fires', async () => {
    const rule = platform.ruleEngine.create('u1', {
      name: 'morning-summary',
      trigger: { kind: 'cron', expression: '0 9 * * *' },
      task: 'Günlük özet çıkar.',
      agentId: 'agency-minimal-engineer'
    });
    const results = await platform.ruleEngine.tick(new Date('2026-01-05T09:00:00'));
    expect(results).toEqual([{ id: rule.id, fired: true }]);
    expect(scheduled).toEqual([{ ownerId: 'u1', agentId: 'agency-minimal-engineer', task: 'Günlük özet çıkar.' }]);
  });
});
