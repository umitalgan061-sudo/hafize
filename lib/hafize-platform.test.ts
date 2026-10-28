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

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC', 'base64');
let platform: HafizePlatform;
let server: Server;
let base = '';

beforeAll(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'hafize-platform-'));
  platform = createHafizePlatform({
    root: fileURLToPath(new URL('../', import.meta.url)),
    env: { HAFIZE_DATA_DIR: dataDir, HAFIZE_WORKSPACE_DIR: join(dataDir, 'ws') },
    apiKey: '',
    nimBaseUrl: 'http://127.0.0.1:9',
    chat: async () => ({ choices: [{ message: { content: '{"summary":"özet","topics":["test"],"facts":[],"followUps":[]}' } }] }),
    webTools: { search: async () => ({ results: [] }), wikipedia: async () => ({}), news: async () => ({ items: [] }), rates: async () => ({}), readPage: async () => ({}) } as never,
    registry: await loadAgentRegistry(),
    skillsRuntime: createBuiltinSkillsRuntimeSync({ auditLog: createSkillAuditLog(), consentRuntime: createSkillConsentRuntime({ filePath: join(dataDir, 'consents.json') }) }),
    executeTool: executeNvidiaToolCall as never,
    allowedTools: getAllowedNvidiaTools as never
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

describe('platform HTTP API', () => {
  it('requires a principal and keeps owners apart', async () => {
    expect((await call('/api/memory', { owner: '' })).status).toBe(401);
    expect((await call('/api/memory', { method: 'POST', body: JSON.stringify({ content: 'Kullanıcı mavi rengi sever.' }) })).status).toBe(201);
    const mine = await (await call('/api/memory')).json() as { records: unknown[] };
    const theirs = await (await call('/api/memory', { owner: 'u2' })).json() as { records: unknown[] };
    expect(mine.records).toHaveLength(1);
    expect(theirs.records).toHaveLength(0);
    const search = await (await call('/api/memory?q=mavi%20renk')).json() as { results: Array<{ content: string }> };
    expect(search.results[0]?.content).toContain('mavi');
    expect((await call('/api/memory', { method: 'DELETE' })).status).toBe(400);
    expect(await (await call('/api/memory?confirm=all', { method: 'DELETE' })).json()).toEqual({ purged: 1 });
  });

  it('stores uploads by real type and serves them inert to their owner only', async () => {
    const svg = await call('/api/uploads/image', { method: 'POST', body: JSON.stringify({ data: Buffer.from('<svg onload=alert(1)>').toString('base64') }) });
    expect(svg.status).toBe(415);
    const upload = await (await call('/api/uploads/image', { method: 'POST', body: JSON.stringify({ data: PNG.toString('base64'), name: 'a.png' }) })).json() as { url: string };
    const image = await call(upload.url);
    expect(image.headers.get('content-type')).toBe('image/png');
    expect(image.headers.get('content-security-policy')).toContain('sandbox');
    expect(Buffer.from(await image.arrayBuffer()).equals(PNG)).toBe(true);
    expect((await call(upload.url, { owner: 'u2' })).status).toBe(404);
  });

  it('stores uploaded documents encrypted, keeps owners apart and never echoes content', async () => {
    const empty = await call('/api/uploads/document', { method: 'POST', body: JSON.stringify({ content: '   ', name: 'x.txt' }) });
    expect(empty.status).toBe(400);
    const upload = await (await call('/api/uploads/document', { method: 'POST', body: JSON.stringify({ content: '# baslik\nicerik', name: 'not.txt', mime: 'text/plain' }) })).json() as { id: string; url: string; name: string };
    expect(upload.url).toMatch(/^\/api\/documents\/doc_[a-f0-9]{20}$/);
    // The reference is all the client ever sees; no endpoint returns the content.
    const list = await (await call('/api/documents')).json() as { documents: Array<{ id: string; name: string; size: number }> };
    expect(list.documents[0]).toMatchObject({ id: upload.id, name: 'not.txt', size: 15 });
    expect(JSON.stringify(list.documents)).not.toContain('baslik');
    expect((await call(upload.url)).status).toBe(404);
    expect(await (await call('/api/documents', { owner: 'u2' })).json()).toEqual({ documents: [] });
    expect(await (await call('/api/documents/' + upload.id, { method: 'DELETE', owner: 'u2' })).json()).toEqual({ removed: false });
    expect(await (await call('/api/documents/' + upload.id, { method: 'DELETE' })).json()).toEqual({ removed: true });
  });

  it('records reversible memory actions from an agent run and undoes them over the API', async () => {
    const run = platform.createRunContext({ principal: { ownerId: 'u3', sessionId: 's' }, traceId: 't1', conversationId: 'c1', emit: null, signal: new AbortController().signal });
    await run.persistence!.save({ id: 'mtest1', text: 'Kullanıcı Bursa’da yaşıyor.', kind: 'semantic', tags: [] });
    const actions = await (await call('/api/actions', { owner: 'u3' })).json() as { actions: Array<{ id: string; tool: string }> };
    expect(actions.actions[0]?.tool).toBe('memory_save');
    expect((await call(`/api/actions/${actions.actions[0]!.id}/undo`, { method: 'POST', owner: 'u3' })).status).toBe(200);
    const records = await (await call('/api/memory', { owner: 'u3' })).json() as { records: unknown[] };
    expect(records.records).toHaveLength(0);
    expect((await call(`/api/actions/${actions.actions[0]!.id}/undo`, { method: 'POST', owner: 'u3' })).status).toBe(409);
  });

  it('serves capabilities, observability, experts and prompts', async () => {
    const caps = await (await call('/api/capabilities')).json() as Record<string, any>;
    expect(caps.memory.encryptedAtRest).toBe(true);
    expect(caps.experts).toBeGreaterThan(5);
    expect((await call('/api/observability/summary')).status).toBe(200);
    expect(await (await call('/api/observability/metrics')).text()).toContain('hafize_feedback_total');
    const experts = await (await call('/api/experts/resolve?q=matematik')).json() as { experts: Array<{ agentId: string }> };
    expect(experts.experts[0]?.agentId).toBe('expert-math');
    expect((await (await call('/api/prompts')).json() as { prompts: unknown[] }).prompts.length).toBeGreaterThan(0);
    expect((await call('/api/approvals/yok', { method: 'POST', body: '{"approved":true}' })).status).toBe(404);
    expect((await call('/api/feedback', { method: 'POST', body: JSON.stringify({ messageId: 'm1', rating: 'up', variant: 'A' }) })).status).toBe(200);
  });
});
