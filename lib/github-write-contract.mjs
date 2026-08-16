const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const OPERATIONS = new Set(['branch.create', 'file.update', 'pr.create', 'pr.merge']);
const COMMON_FIELDS = new Set(['operation', 'repository']);
const HAFIZE_BRANCH_PREFIX = 'hafize/';
const MAX_FILE_BYTES = 64 * 1024;
const MAX_PATH_LENGTH = 400;
const MAX_COMMIT_MESSAGE_LENGTH = 200;
const SENSITIVE_SEGMENT_PATTERNS = [
  /^\.env(?:\.|$)/i,
  /(?:^|[._-])(?:credential|secret|token)s?(?:[._-]|$)/i,
  /(?:^|[._-])private[._-]?key(?:[._-]|$)/i,
  /^id_(?:rsa|ed25519|ecdsa)(?:\.|$)/i,
  /\.(?:pem|key|p12|pfx)$/i
];

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeRepository(value, allowedRepositories) {
  const repository = typeof value === 'string' ? value.trim() : '';
  if (!REPOSITORY_PATTERN.test(repository)) fail('INVALID_GITHUB_WRITE_REPOSITORY');
  if (!(allowedRepositories instanceof Set) || !allowedRepositories.has(repository)) {
    fail('GITHUB_WRITE_REPOSITORY_NOT_ALLOWED');
  }
  return repository;
}

function normalizeRef(value, label) {
  const ref = typeof value === 'string' ? value.trim() : '';
  if (!REF_PATTERN.test(ref) || ref.includes('..') || ref.includes('//') || ref.endsWith('/')) {
    fail(`INVALID_GITHUB_WRITE_${label}`);
  }
  return ref;
}

function normalizeAgentBranch(value, label = 'BRANCH') {
  const branch = normalizeRef(value, label);
  if (!branch.startsWith(HAFIZE_BRANCH_PREFIX) || branch.length <= HAFIZE_BRANCH_PREFIX.length) {
    fail('GITHUB_WRITE_BRANCH_NOT_ALLOWED');
  }
  return branch;
}

function normalizeFilePath(value) {
  const filePath = typeof value === 'string' ? value.trim() : '';
  if (!filePath || filePath.length > MAX_PATH_LENGTH || filePath.startsWith('/') || filePath.includes('\\') || filePath.includes('\0')) {
    fail('INVALID_GITHUB_WRITE_PATH');
  }
  const segments = filePath.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) fail('INVALID_GITHUB_WRITE_PATH');
  if (segments.some((segment) => SENSITIVE_SEGMENT_PATTERNS.some((pattern) => pattern.test(segment)))) {
    fail('SENSITIVE_GITHUB_WRITE_PATH_BLOCKED');
  }
  if (filePath.toLowerCase().startsWith('.github/workflows/')) fail('GITHUB_WORKFLOW_WRITE_BLOCKED');
  return filePath;
}

function normalizeCommitMessage(value) {
  const message = typeof value === 'string' ? value.trim() : '';
  if (!message || message.length > MAX_COMMIT_MESSAGE_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) {
    fail('INVALID_GITHUB_WRITE_COMMIT_MESSAGE');
  }
  return message;
}

function normalizeContent(value) {
  if (typeof value !== 'string' || !value.length || value.includes('\0')) fail('INVALID_GITHUB_WRITE_CONTENT');
  if (Buffer.byteLength(value, 'utf8') > MAX_FILE_BYTES) fail('GITHUB_WRITE_CONTENT_TOO_LARGE');
  return value;
}

function normalizeSha(value, code) {
  const sha = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!SHA_PATTERN.test(sha)) fail(code);
  return sha;
}

function rejectUnknownFields(input, allowed) {
  for (const key of Object.keys(input)) if (!allowed.has(key)) fail('INVALID_GITHUB_WRITE_FIELD');
}

export function normalizeGitHubWriteRequest(input, { allowedRepositories, approvalGranted = false } = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_GITHUB_WRITE_REQUEST');
  const operation = typeof input.operation === 'string' ? input.operation.trim() : '';
  if (!OPERATIONS.has(operation)) fail('INVALID_GITHUB_WRITE_OPERATION');
  if (approvalGranted !== true) fail('GITHUB_WRITE_APPROVAL_REQUIRED');
  const repository = normalizeRepository(input.repository, allowedRepositories);

  if (operation === 'branch.create') {
    rejectUnknownFields(input, new Set([...COMMON_FIELDS, 'branch', 'baseRef']));
    const branch = normalizeAgentBranch(input.branch);
    const baseRef = normalizeRef(input.baseRef, 'BASE_REF');
    if (branch === baseRef) fail('INVALID_GITHUB_WRITE_BRANCH');
    return Object.freeze({ operation, repository, branch, baseRef });
  }

  if (operation === 'file.update') {
    rejectUnknownFields(input, new Set([...COMMON_FIELDS, 'branch', 'path', 'expectedBlobSha', 'commitMessage', 'content']));
    return Object.freeze({
      operation,
      repository,
      branch: normalizeAgentBranch(input.branch),
      path: normalizeFilePath(input.path),
      expectedBlobSha: normalizeSha(input.expectedBlobSha, 'INVALID_GITHUB_WRITE_BLOB_SHA'),
      commitMessage: normalizeCommitMessage(input.commitMessage),
      content: normalizeContent(input.content)
    });
  }

  if (operation === 'pr.create') {
    rejectUnknownFields(input, new Set([...COMMON_FIELDS, 'head', 'base', 'title', 'draft']));
    const head = normalizeAgentBranch(input.head, 'HEAD');
    const base = normalizeRef(input.base, 'BASE');
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title || title.length > 180 || head === base) fail('INVALID_GITHUB_WRITE_PR');
    if (input.draft !== true) fail('GITHUB_WRITE_PR_MUST_BE_DRAFT');
    return Object.freeze({ operation, repository, head, base, title, draft: true });
  }

  rejectUnknownFields(input, new Set([...COMMON_FIELDS, 'prNumber', 'expectedHeadSha']));
  if (!Number.isInteger(input.prNumber) || input.prNumber < 1) fail('INVALID_GITHUB_WRITE_PR_NUMBER');
  return Object.freeze({
    operation,
    repository,
    prNumber: input.prNumber,
    expectedHeadSha: normalizeSha(input.expectedHeadSha, 'INVALID_GITHUB_WRITE_HEAD_SHA')
  });
}

export const GITHUB_WRITE_OPERATIONS = Object.freeze([...OPERATIONS]);
export const GITHUB_WRITE_LIMITS = Object.freeze({
  branchPrefix: HAFIZE_BRANCH_PREFIX,
  maxFileBytes: MAX_FILE_BYTES,
  maxPathLength: MAX_PATH_LENGTH,
  maxCommitMessageLength: MAX_COMMIT_MESSAGE_LENGTH
});
