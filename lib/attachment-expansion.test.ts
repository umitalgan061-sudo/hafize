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

beforeAll(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'hafize-attach-'));
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

describe('attachment expansion', () => {
  it('expands a document reference into content for the model, without echoing it to the chat', async () => {
    const upload = await (await call('/api/uploads/document', { method: 'POST', body: JSON.stringify({ content: 'gizli icerik satiri', name: 'sir.txt', mime: 'text/plain' }) })).json() as { url: string };

    // The message the client actually sends carries only the reference.
    const userText = `Bu dosyayi incele\n[Ekli dosya: sir.txt](${upload.url})`;
    const expanded = await platform.analyzeAttachments('u1', userText, 'trace-1', new AbortController().signal);

    // The model receives the content...
    expect(expanded.untrusted).toBe(true);
    expect(expanded.text).toContain('gizli icerik satiri');
    expect(expanded.text).toContain('[Ekli dosya: sir.txt]');
    // ...while the user-visible text stays a one-line reference.
    expect(userText).not.toContain('gizli icerik satiri');
    expect(userText.length).toBeLessThan(120);
  });

  it('accepts a document far larger than the old 384 KB cap', async () => {
    // 2 MB of text: the previous client-side limit rejected anything above 384 KB. Storage keeps it
    // whole; the model-facing budget clips what is actually sent.
    const upload = await (await call('/api/uploads/document', { method: 'POST', body: JSON.stringify({ content: 'y'.repeat(2 * 1024 * 1024), name: 'buyuk.txt', mime: 'text/plain' }) })).json() as { id: string; url: string; size: number };
    expect(upload.size).toBe(2 * 1024 * 1024);
    const list = await (await call('/api/documents')).json() as { documents: Array<{ id: string; size: number }> };
    expect(list.documents[0]).toMatchObject({ id: upload.id, size: 2 * 1024 * 1024 });
    const expanded = await platform.analyzeAttachments('u1', `[Ekli dosya: buyuk.txt](${upload.url})`, 't', new AbortController().signal);
    // Stored whole, sent clipped, and the clipping is stated to the model.
    expect(expanded.text).toContain('y'.repeat(1024));
    expect(expanded.text).toContain('[Dosya uzun olduğu için ilk');
  });

  it('bounds the total expanded content so the model prompt stays inside its context', async () => {
    // Three documents that together exceed the model-facing budget.
    const urls: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const upload = await (await call('/api/uploads/document', { method: 'POST', body: JSON.stringify({ content: `d${index}-` + 'z'.repeat(300_000), name: `big${index}.txt` }) })).json() as { url: string };
      urls.push(upload.url);
    }
    const text = urls.map((url, index) => `[Ekli dosya: big${index}.txt](${url})`).join('\n');
    const expanded = await platform.analyzeAttachments('u1', text, 't', new AbortController().signal);
    // The prompt stays bounded even though 900 KB was uploaded.
    expect(expanded.text.length).toBeLessThanOrEqual(200_000 + 2_000);
    expect(expanded.text).toContain('[Not:');
  });

  it('tells the model when a referenced document no longer exists', async () => {
    // Upload, then delete: the composer can still hold the reference in a saved draft.
    const upload = await (await call('/api/uploads/document', { method: 'POST', body: JSON.stringify({ content: 'gecici icerik', name: 'silinen.txt' }) })).json() as { id: string; url: string };
    await call(`/api/documents/${upload.id}`, { method: 'DELETE' });
    const expanded = await platform.analyzeAttachments('u1', `[Ekli dosya: silinen.txt](${upload.url})`, 't', new AbortController().signal);
    expect(expanded.text).toContain('artık sunucuda bulunamadı');
    expect(expanded.text).toContain('yeniden yüklemesini');
    // A missing reference is not outside data, so it must not taint the memory session.
    expect(expanded.untrusted).toBe(false);
  });

  it('returns nothing for a message with no attachment', async () => {
    expect(await platform.analyzeAttachments('u1', 'merhaba', 't', new AbortController().signal)).toEqual({ text: '', untrusted: false });
  });

  it('never expands a reference owned by someone else and says so instead of staying silent', async () => {
    const upload = await (await call('/api/uploads/document', { owner: 'u2', method: 'POST', body: JSON.stringify({ content: 'baska sahip', name: 'x.txt' }) })).json() as { url: string };
    const expanded = await platform.analyzeAttachments('u1', `[Ekli dosya: x.txt](${upload.url})`, 't', new AbortController().signal);
    // The content never crosses owners; the model is told the reference is unresolved.
    expect(expanded.text).not.toContain('baska sahip');
    expect(expanded.text).toContain('bulunamadı');
    expect(expanded.untrusted).toBe(false);
  });

  it('caps the number of expanded documents at twenty', async () => {
    const urls: string[] = [];
    for (let index = 0; index < 25; index += 1) {
      const upload = await (await call('/api/uploads/document', { method: 'POST', body: JSON.stringify({ content: `icerik ${index}`, name: `f${index}.txt` }) })).json() as { url: string };
      urls.push(upload.url);
    }
    const text = urls.map((url, index) => `[Ekli dosya: f${index}.txt](${url})`).join('\n');
    const expanded = await platform.analyzeAttachments('u1', text, 't', new AbortController().signal);
    expect((expanded.text.match(/\[Ekli dosya:/g) || []).length).toBe(20);
  });
});
