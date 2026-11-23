import { describe, expect, it, vi } from 'vitest';
import { executeNvidiaToolCall, getAllowedNvidiaTools } from './tool-runtime.ts';

const agent = {
  id: 'hafize-general', name: 'Hafize',
  toolPolicy: { default: 'deny' as const, allow: ['repo.write_request'], deny: [], approvalRequired: [] }
};
const args = { operation: 'branch', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/auto-test' };
const call = { id: 'github-dev-test', function: { name: 'github_develop', arguments: JSON.stringify(args) } };

function setup(ready = true, approved = true) {
  const execute = vi.fn(async () => ({ action: 'branch', branch: args.branch }));
  const context = {
    traceId: 'trace-dev',
    agent,
    githubDevelopment: { enabled: () => ready, execute },
    ...(approved ? { requestApproval: async () => true } : {})
  };
  return { context, execute };
}

describe('GitHub agent tool availability and execution', () => {
  it('does not advertise GitHub writes without an interactive approval channel', async () => {
    const { context, execute } = setup(true, false);
    expect(getAllowedNvidiaTools(agent, context).map((t) => t.function.name)).not.toContain('github_develop');
    const result = await executeNvidiaToolCall(agent, call, context);
    expect(result).toMatchObject({ ok: false, error: 'TOOL_UNAVAILABLE' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not advertise writes when the GitHub App bridge is disabled', async () => {
    const { context, execute } = setup(false);
    expect(getAllowedNvidiaTools(agent, context).map((t) => t.function.name)).not.toContain('github_develop');
    expect((await executeNvidiaToolCall(agent, call, context)).ok).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('runs the single approved GitHub action via the bridge', async () => {
    const { context, execute } = setup();
    expect(getAllowedNvidiaTools(agent, context).map((t) => t.function.name)).toContain('github_develop');
    const result = await executeNvidiaToolCall(agent, call, context);
    expect(result).toMatchObject({ ok: true, tool: 'github_develop' });
    expect(execute).toHaveBeenCalledWith(args, { requestApproval: context.requestApproval });
  });

  it('never bypasses an agent-specific deny policy', async () => {
    const { context, execute } = setup();
    const blocked = { ...agent, toolPolicy: { ...agent.toolPolicy, deny: ['repo.write_request'] } };
    expect(getAllowedNvidiaTools(blocked, context).map((t) => t.function.name)).not.toContain('github_develop');
    expect((await executeNvidiaToolCall(blocked, call, context)).ok).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });
});
