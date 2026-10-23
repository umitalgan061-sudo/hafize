import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadAgentRegistry, resolveAgent } from './agent-runtime.ts';
import { executeNvidiaToolCall, getAllowedNvidiaTools, isSensitiveWorkspacePath } from './tool-runtime.ts';

const workspaceRoot = fileURLToPath(new URL('../', import.meta.url));
const reader = { id: 'fs-test', name: 'FS Test', description: 'test', toolPolicy: { default: 'deny' as const, allow: ['fs.read'], deny: [], approvalRequired: [] } };
const read = (args: Record<string, unknown>) => executeNvidiaToolCall(reader, { id: 'c1', type: 'function', function: { name: 'fs_read', arguments: JSON.stringify(args) } }, { traceId: '00000000-0000-4000-8000-000000000001', agent: reader, workspaceRoot });

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
