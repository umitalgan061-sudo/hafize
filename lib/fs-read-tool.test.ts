import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadAgentRegistry, resolveAgent } from './agent-runtime.ts';
import { executeNvidiaToolCall, getAllowedNvidiaTools, isSensitiveWorkspacePath } from './tool-runtime.ts';

const workspaceRoot = fileURLToPath(new URL('../', import.meta.url));
const reader = { id: 'fs-test', name: 'FS Test', description: 'test', toolPolicy: { default: 'deny' as const, allow: ['fs.read'], deny: [], approvalRequired: [] } };
// A throwaway workspace with a real .env, so the secret guard is exercised on every machine
// (CI checkouts have no .env) without ever touching a developer's own .env.
let fixtureRoot = '';
beforeAll(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), 'hafize-fs-read-'));
  writeFileSync(join(fixtureRoot, '.env'), 'NVIDIA_API_KEY=fixture-not-a-secret\n');
  writeFileSync(join(fixtureRoot, 'README.md'), '# Fixture workspace\n\nUsed by fs-read-tool.test.ts.\n');
  mkdirSync(join(fixtureRoot, 'lib'));
});
afterAll(() => { if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true }); });
const read = (args: Record<string, unknown>) => executeNvidiaToolCall(reader, { id: 'c1', type: 'function', function: { name: 'fs_read', arguments: JSON.stringify(args) } }, { traceId: '00000000-0000-4000-8000-000000000001', agent: reader, workspaceRoot: fixtureRoot });

describe('fs_read', () => {
  it('flags secret-bearing paths', () => {
    for (const path of ['.env', '.env.example', '.git/config', 'data/skill-audit.jsonl', 'node_modules/x/index.js', 'certs/server.pem', 'hafize-server.log', 'my-token.txt', 'lib/.hidden/x.ts', '']) {
      expect(isSensitiveWorkspacePath(path), path).toBe(true);
    }
    for (const path of ['README.md', 'lib/tool-runtime.ts', 'docs/DEVELOPMENT_ROADMAP.md']) expect(isSensitiveWorkspacePath(path), path).toBe(false);
  });

  it('never returns .env, runtime data or encoded content', async () => {
    await expect(read({ path: '.env' })).resolves.toMatchObject({ ok: true, value: { code: 'SENSITIVE_PATH' } });
    await expect(read({ path: 'lib/../.env' })).resolves.toMatchObject({ value: { code: 'SENSITIVE_PATH' } });
    await expect(read({ path: '../../../Windows/win.ini' })).resolves.toMatchObject({ value: { code: 'TRAVERSAL' } });
    await expect(read({ path: 'README.md', encoding: 'base64' })).resolves.toMatchObject({ value: { code: 'INVALID_ENCODING' } });
    const readme = await read({ path: 'README.md' });
    expect(readme).toMatchObject({ ok: true, value: { path: 'README.md' } });
    expect(String((readme as { value: { content: string } }).value.content).length).toBeGreaterThan(10);
  });

  it('is not offered to the user-facing Hafize agent', async () => {
    const registry = await loadAgentRegistry();
    const hafize = resolveAgent(registry, 'hafize-general')!;
    expect(getAllowedNvidiaTools(hafize, { workspaceRoot }).map((tool) => tool.function.name)).not.toContain('fs_read');
  });
});
