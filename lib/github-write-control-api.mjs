const PREPARE_PATH = '/api/github/write/prepare';
const EXECUTE_PATH = '/api/github/write/execute';
const BODY_FIELDS = new Set(['explicitUserIntent', 'command', 'approvalToken']);
const SAFE_ERRORS = new Map([
  ['AUTH_REQUIRED', 401],
  ['INVALID_GITHUB_WRITE_CONTROL_REQUEST', 400],
  ['INVALID_GITHUB_WRITE_REQUEST', 400],
  ['INVALID_GITHUB_WRITE_OPERATION', 400],
  ['INVALID_GITHUB_WRITE_FIELD', 400],
  ['INVALID_GITHUB_WRITE_REPOSITORY', 400],
  ['GITHUB_WRITE_REPOSITORY_NOT_ALLOWED', 403],
  ['GITHUB_WRITE_APPROVAL_EXPIRED', 409],
  ['GITHUB_WRITE_APPROVAL_MISMATCH', 409],
  ['GITHUB_WRITE_APPROVAL_REPLAYED', 409],
  ['GITHUB_WRITE_APPROVAL_INVALID', 409],
  ['GITHUB_WRITE_CANCELLED', 409],
  ['GITHUB_WRITE_EXECUTION_FAILED', 502],
  ['INVALID_GITHUB_WRITE_RECEIPT', 502]
]);

function response(status, body) {
  return Object.freeze({ matched: true, status, body, headers: Object.freeze({ 'Cache-Control': 'no-store' }) });
}

function failRequest() {
  return response(400, { error: 'INVALID_GITHUB_WRITE_CONTROL_REQUEST' });
}

function cleanBody(body, mode) {
  if (!body || Array.isArray(body) || typeof body !== 'object') return null;
  for (const key of Object.keys(body)) if (!BODY_FIELDS.has(key)) return null;
  if (body.explicitUserIntent !== true || !body.command || Array.isArray(body.command) || typeof body.command !== 'object') return null;
  if (mode === 'prepare') {
    if ('approvalToken' in body) return null;
    return { command: body.command };
  }
  const approvalToken = typeof body.approvalToken === 'string' ? body.approvalToken.trim() : '';
  if (!approvalToken || approvalToken.length > 2_048) return null;
  return { command: body.command, approvalToken };
}

function summarize(command) {
  const summary = { operation: command.operation, repository: command.repository };
  if (command.operation === 'branch.create') summary.branch = command.branch;
  else if (command.operation === 'file.update') Object.assign(summary, { branch: command.branch, path: command.path });
  else if (command.operation === 'pr.create') Object.assign(summary, { head: command.head, base: command.base });
  else if (command.operation === 'pr.merge') summary.prNumber = command.prNumber;
  return Object.freeze(summary);
}

function safeError(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const status = SAFE_ERRORS.get(code);
  return status ? response(status, { error: code }) : response(500, { error: 'GITHUB_WRITE_CONTROL_FAILED' });
}

export function createGitHubWriteControlApi({ authenticator, approvalBoundary, executionBoundary, readJson } = {}) {
  if (typeof authenticator?.authenticate !== 'function') throw new Error('INVALID_GITHUB_WRITE_CONTROL_AUTH');
  if (typeof approvalBoundary?.prepare !== 'function') throw new Error('INVALID_GITHUB_WRITE_CONTROL_APPROVAL');
  if (typeof executionBoundary?.execute !== 'function') throw new Error('INVALID_GITHUB_WRITE_CONTROL_EXECUTION');
  if (typeof readJson !== 'function') throw new Error('INVALID_GITHUB_WRITE_CONTROL_JSON');

  async function handle({ request, method, pathname, headers, signal } = {}) {
    if (pathname !== PREPARE_PATH && pathname !== EXECUTE_PATH) return Object.freeze({ matched: false });
    if (method !== 'POST') return response(405, { error: 'METHOD_NOT_ALLOWED' });

    const authentication = authenticator.authenticate({ headers });
    if (!authentication?.ok || !authentication.principal) return response(401, { error: 'AUTH_REQUIRED' });
    if (signal?.aborted) return response(409, { error: 'GITHUB_WRITE_CANCELLED' });

    let body;
    try { body = await readJson(request); }
    catch { return failRequest(); }

    const mode = pathname === PREPARE_PATH ? 'prepare' : 'execute';
    const normalized = cleanBody(body, mode);
    if (!normalized) return failRequest();

    try {
      if (mode === 'prepare') {
        const prepared = approvalBoundary.prepare(normalized.command, { principal: authentication.principal });
        return response(200, {
          approvalToken: prepared.approvalToken,
          expiresAt: prepared.expiresAt,
          command: summarize(prepared.command)
        });
      }
      const receipt = await executionBoundary.execute(normalized.command, {
        principal: authentication.principal,
        approvalToken: normalized.approvalToken,
        signal
      });
      return response(200, { receipt });
    } catch (error) {
      return safeError(error);
    }
  }

  return Object.freeze({ handle });
}

export const GITHUB_WRITE_CONTROL_PATHS = Object.freeze({ prepare: PREPARE_PATH, execute: EXECUTE_PATH });
