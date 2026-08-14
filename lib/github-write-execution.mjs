const SHA_PATTERN = /^[a-f0-9]{40}$/;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function sanitizeReceipt(command, result) {
  if (!result || Array.isArray(result) || typeof result !== 'object') fail('INVALID_GITHUB_WRITE_RECEIPT');
  if (command.operation === 'branch.create') {
    const sha = typeof result.sha === 'string' ? result.sha.trim().toLowerCase() : '';
    if (!SHA_PATTERN.test(sha)) fail('INVALID_GITHUB_WRITE_RECEIPT');
    return Object.freeze({ operation: command.operation, repository: command.repository, branch: command.branch, sha });
  }
  if (command.operation === 'pr.create') {
    if (!Number.isInteger(result.prNumber) || result.prNumber < 1) fail('INVALID_GITHUB_WRITE_RECEIPT');
    return Object.freeze({
      operation: command.operation,
      repository: command.repository,
      prNumber: result.prNumber,
      url: `https://github.com/${command.repository}/pull/${result.prNumber}`
    });
  }
  const sha = typeof result.sha === 'string' ? result.sha.trim().toLowerCase() : '';
  if (result.merged !== true || !SHA_PATTERN.test(sha)) fail('INVALID_GITHUB_WRITE_RECEIPT');
  return Object.freeze({ operation: command.operation, repository: command.repository, prNumber: command.prNumber, merged: true, sha });
}

export function createGitHubWriteExecutionBoundary({ approvalBoundary, writer } = {}) {
  if (typeof approvalBoundary?.consume !== 'function') fail('INVALID_GITHUB_WRITE_APPROVAL_BOUNDARY');
  if (typeof writer?.createBranch !== 'function' || typeof writer?.createPullRequest !== 'function' || typeof writer?.mergePullRequest !== 'function') {
    fail('INVALID_GITHUB_WRITE_WRITER');
  }

  async function execute(input, { principal, approvalToken, signal } = {}) {
    if (signal?.aborted) fail('GITHUB_WRITE_CANCELLED');
    const command = approvalBoundary.consume(input, { principal, approvalToken });
    let result;
    try {
      if (command.operation === 'branch.create') result = await writer.createBranch(command, { signal });
      else if (command.operation === 'pr.create') result = await writer.createPullRequest(command, { signal });
      else result = await writer.mergePullRequest(command, { signal });
    } catch {
      if (signal?.aborted) fail('GITHUB_WRITE_CANCELLED');
      fail('GITHUB_WRITE_EXECUTION_FAILED');
    }
    return sanitizeReceipt(command, result);
  }

  return Object.freeze({ execute });
}
