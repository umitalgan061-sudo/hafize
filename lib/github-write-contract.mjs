import { optionsOf } from './boundary-input.mjs';

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const OPERATIONS = new Set(['branch.create', 'pr.create', 'pr.merge']);
const COMMON_FIELDS = new Set(['operation', 'repository', 'approvalGranted']);

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

function requireApproval(value) {
  if (value !== true) fail('GITHUB_WRITE_APPROVAL_REQUIRED');
}

function rejectUnknownFields(input, allowed) {
  for (const key of Object.keys(input)) if (!allowed.has(key)) fail('INVALID_GITHUB_WRITE_FIELD');
}

export function normalizeGitHubWriteRequest(input, options) {
  const { allowedRepositories } = optionsOf(options);
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_GITHUB_WRITE_REQUEST');
  const operation = typeof input.operation === 'string' ? input.operation.trim() : '';
  if (!OPERATIONS.has(operation)) fail('INVALID_GITHUB_WRITE_OPERATION');
  requireApproval(input.approvalGranted);
  const repository = normalizeRepository(input.repository, allowedRepositories);

  if (operation === 'branch.create') {
    rejectUnknownFields(input, new Set([...COMMON_FIELDS, 'branch', 'baseRef']));
    const branch = normalizeRef(input.branch, 'BRANCH');
    const baseRef = normalizeRef(input.baseRef, 'BASE_REF');
    if (branch === baseRef) fail('INVALID_GITHUB_WRITE_BRANCH');
    return Object.freeze({ operation, repository, branch, baseRef });
  }

  if (operation === 'pr.create') {
    rejectUnknownFields(input, new Set([...COMMON_FIELDS, 'head', 'base', 'title', 'draft']));
    const head = normalizeRef(input.head, 'HEAD');
    const base = normalizeRef(input.base, 'BASE');
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title || title.length > 180 || head === base) fail('INVALID_GITHUB_WRITE_PR');
    if (input.draft !== true) fail('GITHUB_WRITE_PR_MUST_BE_DRAFT');
    return Object.freeze({ operation, repository, head, base, title, draft: true });
  }

  rejectUnknownFields(input, new Set([...COMMON_FIELDS, 'prNumber', 'expectedHeadSha']));
  if (!Number.isInteger(input.prNumber) || input.prNumber < 1) fail('INVALID_GITHUB_WRITE_PR_NUMBER');
  const expectedHeadSha = typeof input.expectedHeadSha === 'string' ? input.expectedHeadSha.trim().toLowerCase() : '';
  if (!SHA_PATTERN.test(expectedHeadSha)) fail('INVALID_GITHUB_WRITE_HEAD_SHA');
  return Object.freeze({ operation, repository, prNumber: input.prNumber, expectedHeadSha });
}

export const GITHUB_WRITE_OPERATIONS = Object.freeze([...OPERATIONS]);
