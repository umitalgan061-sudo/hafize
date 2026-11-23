import { describe, expect, it, vi } from 'vitest';
import { createGitHubAgentDevelopment } from './github-agent-development.ts';
import type { createGitHubWorkspaceWriter } from './github-workspace-write.ts';

type Writer = ReturnType<typeof createGitHubWorkspaceWriter>;
const REPOSITORY = 'umitalgan061-sudo/hafize';
const BRANCH = 'hafize/auto-safe-change';

function fixture() {
  const writer = {
    configured: vi.fn(() => true),
    normalizeInput: vi.fn((_kind: unknown, input: unknown) => input),
    issueApproval: vi.fn(() => ({ ticket: 'single-use-ticket' })),
    createBranch: vi.fn(async () => ({ action: 'branch', branch: BRANCH })),
    commitFile: vi.fn(async () => ({ action: 'file', branch: BRANCH })),
    createPullRequest: vi.fn(async () => ({ action: 'pull', draft: true }))
  };
  const tool = createGitHubAgentDevelopment({
    writer: writer as unknown as Writer,
    allowedRepositories: [REPOSITORY]
  });
  const requestApproval = vi.fn(async () => true);
  return { writer, tool, requestApproval };
}

describe('GitHub App agent development boundary', () => {
  it('exposes readiness only with an allowlisted and configured writer', () => {
    const { tool, writer } = fixture();
    expect(tool.enabled()).toBe(true);
    writer.configured.mockReturnValue(false);
    expect(tool.enabled()).toBe(false);
    expect(createGitHubAgentDevelopment({ writer: writer as unknown as Writer, allowedRepositories: [] }).enabled()).toBe(false);
  });

  it('requires the interactive approval channel before a write', async () => {
    const { tool, writer } = fixture();
    await expect(tool.execute({ operation: 'branch', repository: REPOSITORY, branch: BRANCH }, {}))
      .rejects.toMatchObject({ code: 'GITHUB_WRITE_APPROVAL_REQUIRED' });
    expect(writer.issueApproval).not.toHaveBeenCalled();
  });

  it('uses standing owner approval for feature branch and draft PR without a separate prompt', async () => {
    const { tool, writer, requestApproval } = fixture();
    const result = await tool.execute({
      operation: 'branch', repository: REPOSITORY, branch: BRANCH
    }, { safeAutonomy: true });
    expect(result).toMatchObject({ action: 'branch' });
    expect(writer.issueApproval).toHaveBeenCalledWith('branch', {
      repository: REPOSITORY, branch: BRANCH, fromRef: 'main'
    }, true);
    expect(requestApproval).not.toHaveBeenCalled();
    await tool.execute({
      operation: 'pull', repository: REPOSITORY, branch: BRANCH, title: 'Safe review'
    }, { safeAutonomy: true });
    expect(writer.createPullRequest).toHaveBeenCalledWith('single-use-ticket',
      expect.objectContaining({ head: BRANCH, base: 'main', draft: true }));
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it('even in safe autonomy rejects unauthorized repos, branches and arbitrary write controls', async () => {
    const { tool, writer } = fixture();
    await expect(tool.execute({
      operation: 'file', repository: REPOSITORY, branch: 'main',
      path: 'src/safe.ts', message: 'edit', content: 'ok'
    }, { safeAutonomy: true })).rejects.toMatchObject({ code: 'INVALID_GITHUB_BRANCH' });
    await expect(tool.execute({
      operation: 'branch', repository: 'umitalgan061-sudo/retake', branch: BRANCH
    }, { safeAutonomy: true })).rejects.toMatchObject({ code: 'GITHUB_REPO_NOT_ALLOWED' });
    await expect(tool.execute({
      operation: 'pull', repository: REPOSITORY, branch: BRANCH,
      title: 'unsafe', draft: false
    }, { safeAutonomy: true })).rejects.toMatchObject({ code: 'INVALID_GITHUB_ARGUMENTS' });
    expect(writer.issueApproval).not.toHaveBeenCalled();
  });

  it('only accepts a separate Hafize feature branch and its allowlisted repo', async () => {
    const { tool, writer, requestApproval } = fixture();
    for (const branch of ['main', 'feature/unsafe', 'hafize/auto-../escape', 'hafize/auto-bad.lock']) {
      await expect(tool.execute({ operation: 'branch', repository: REPOSITORY, branch }, { requestApproval }))
        .rejects.toMatchObject({ code: 'INVALID_GITHUB_BRANCH' });
    }
    await expect(tool.execute({ operation: 'branch', repository: 'umitalgan061-sudo/retake', branch: BRANCH }, { requestApproval }))
      .rejects.toMatchObject({ code: 'GITHUB_REPO_NOT_ALLOWED' });
    expect(requestApproval).not.toHaveBeenCalled();
    expect(writer.issueApproval).not.toHaveBeenCalled();
  });

  it('refuses model-supplied extra control fields', async () => {
    const { tool, writer, requestApproval } = fixture();
    await expect(tool.execute({ operation: 'pull', repository: REPOSITORY, branch: BRANCH, title: 'Change', draft: false }, { requestApproval }))
      .rejects.toMatchObject({ code: 'INVALID_GITHUB_ARGUMENTS' });
    expect(writer.issueApproval).not.toHaveBeenCalled();
  });

  it('creates a branch from main only AFTER per-action approval', async () => {
    const { tool, writer, requestApproval } = fixture();
    requestApproval.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const input = { operation: 'branch', repository: REPOSITORY, branch: BRANCH };
    await expect(tool.execute(input, { requestApproval }))
      .rejects.toMatchObject({ code: 'GITHUB_WRITE_APPROVAL_REQUIRED' });
    expect(writer.createBranch).not.toHaveBeenCalled();
    await tool.execute(input, { requestApproval });
    const payload = { repository: REPOSITORY, branch: BRANCH, fromRef: 'main' };
    expect(writer.normalizeInput).toHaveBeenCalledWith('branch', payload);
    expect(writer.issueApproval).toHaveBeenCalledWith('branch', payload, true);
    expect(writer.createBranch).toHaveBeenCalledWith('single-use-ticket', payload);
  });

  it('ties an exact file body and expected SHA to a distinct explicit approval', async () => {
    const { tool, writer, requestApproval } = fixture();
    const content = 'export const newValue = 1;\n';
    await tool.execute({
      operation: 'file', repository: REPOSITORY, branch: BRANCH,
      path: 'lib/example.ts', content, message: 'feat: example', existingSha: 'a'.repeat(40)
    }, { requestApproval });
    const approval = requestApproval.mock.calls[0]![0];
    expect(approval.kind).toBe('github.development.file');
    expect(approval.detail).toContain('SHA-256:');
    expect(approval.detail).toContain('lib/example.ts');
    expect(writer.commitFile).toHaveBeenCalledWith('single-use-ticket', expect.objectContaining({
      path: 'lib/example.ts', existingSha: 'a'.repeat(40), content
    }));
  });

  it('forces every agent pull request to be draft and target main', async () => {
    const { tool, writer, requestApproval } = fixture();
    await tool.execute({
      operation: 'pull', repository: REPOSITORY, branch: BRANCH,
      title: 'Safe change', body: 'Tests pending review'
    }, { requestApproval });
    expect(writer.createPullRequest).toHaveBeenCalledWith('single-use-ticket', {
      repository: REPOSITORY, head: BRANCH, base: 'main',
      title: 'Safe change', body: 'Tests pending review', draft: true
    });
  });

  it('does not ask approval or issue tickets when core writer rejects secrets', async () => {
    const { tool, writer, requestApproval } = fixture();
    writer.normalizeInput.mockImplementationOnce(() => { throw Object.assign(new Error('blocked'), { code: 'GITHUB_CONTENT_CREDENTIAL_BLOCKED' }); });
    await expect(tool.execute({
      operation: 'file', repository: REPOSITORY, branch: BRANCH,
      path: '.env', content: 'DUMMY=1', message: 'unsafe'
    }, { requestApproval })).rejects.toMatchObject({ code: 'GITHUB_CONTENT_CREDENTIAL_BLOCKED' });
    expect(requestApproval).not.toHaveBeenCalled();
    expect(writer.issueApproval).not.toHaveBeenCalled();
  });
});
