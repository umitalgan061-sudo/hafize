import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { normalizeGitHubWriteRequest } from './github-write-contract.mjs';

const TOKEN_PREFIX = 'gw1';
const DEFAULT_TTL_MS = 120_000;
const MAX_TTL_MS = 300_000;
const NONCE_BYTES = 16;
const OWNER_PATTERN = /^owner_[A-Za-z0-9_-]{43}$/;
const TOKEN_PATTERN = /^gw1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/;
const PAYLOAD_FIELDS = new Set(['v', 'n', 'e', 'o', 'd']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeSecret(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) fail('INVALID_GITHUB_WRITE_APPROVAL_SECRET');
  const secret = Buffer.from(value);
  if (secret.length < 32) fail('INVALID_GITHUB_WRITE_APPROVAL_SECRET');
  return secret;
}

function resolveOwner(ownerResolver, principal) {
  const ownership = ownerResolver?.resolve?.(principal);
  if (!ownership || typeof ownership.ownerId !== 'string' || !OWNER_PATTERN.test(ownership.ownerId)) {
    fail('INVALID_GITHUB_WRITE_APPROVAL_OWNER');
  }
  return ownership.ownerId;
}

function canonicalCommand(command) {
  if (command.operation === 'branch.create') {
    return JSON.stringify(['branch.create', command.repository, command.branch, command.baseRef]);
  }
  if (command.operation === 'pr.create') {
    return JSON.stringify(['pr.create', command.repository, command.head, command.base, command.title, true]);
  }
  return JSON.stringify(['pr.merge', command.repository, command.prNumber, command.expectedHeadSha]);
}

function commandDigest(command) {
  return createHash('sha256').update('hafize:github-write-command:v1\0').update(canonicalCommand(command)).digest('base64url');
}

function sign(secret, body) {
  return createHmac('sha256', secret).update('hafize:github-write-approval:v1\0').update(body).digest();
}

function parseToken(token, secret) {
  const normalized = typeof token === 'string' ? token.trim() : '';
  if (normalized.length > 2_048) fail('GITHUB_WRITE_APPROVAL_INVALID');
  const match = TOKEN_PATTERN.exec(normalized);
  if (!match) fail('GITHUB_WRITE_APPROVAL_INVALID');
  const [, body, encodedMac] = match;
  let actualMac;
  try {
    actualMac = Buffer.from(encodedMac, 'base64url');
  } catch {
    fail('GITHUB_WRITE_APPROVAL_INVALID');
  }
  const expectedMac = sign(secret, body);
  if (actualMac.length !== expectedMac.length || !timingSafeEqual(actualMac, expectedMac)) {
    fail('GITHUB_WRITE_APPROVAL_INVALID');
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    fail('GITHUB_WRITE_APPROVAL_INVALID');
  }
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') fail('GITHUB_WRITE_APPROVAL_INVALID');
  for (const key of Object.keys(payload)) if (!PAYLOAD_FIELDS.has(key)) fail('GITHUB_WRITE_APPROVAL_INVALID');
  if (payload.v !== 1 || typeof payload.n !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(payload.n)) fail('GITHUB_WRITE_APPROVAL_INVALID');
  if (!Number.isSafeInteger(payload.e) || !OWNER_PATTERN.test(payload.o || '') || !/^[A-Za-z0-9_-]{43}$/.test(payload.d || '')) {
    fail('GITHUB_WRITE_APPROVAL_INVALID');
  }
  return payload;
}

export function createGitHubWriteApprovalBoundary({
  secret,
  allowedRepositories,
  ownerResolver,
  ttlMs = DEFAULT_TTL_MS,
  now = () => Date.now(),
  randomBytesImpl = randomBytes
} = {}) {
  const approvalSecret = normalizeSecret(secret);
  if (!(allowedRepositories instanceof Set) || allowedRepositories.size < 1) fail('INVALID_GITHUB_WRITE_APPROVAL_REPOSITORIES');
  if (typeof ownerResolver?.resolve !== 'function') fail('INVALID_GITHUB_WRITE_APPROVAL_OWNER_RESOLVER');
  if (!Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > MAX_TTL_MS) fail('INVALID_GITHUB_WRITE_APPROVAL_TTL');
  if (typeof now !== 'function' || typeof randomBytesImpl !== 'function') fail('INVALID_GITHUB_WRITE_APPROVAL_RUNTIME');
  const usedNonces = new Map();

  function currentTime() {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_GITHUB_WRITE_APPROVAL_CLOCK');
    return value;
  }

  function cleanup(at) {
    for (const [nonce, expiresAt] of usedNonces) if (expiresAt <= at) usedNonces.delete(nonce);
  }

  function normalizeCommand(input) {
    return normalizeGitHubWriteRequest(input, { allowedRepositories, approvalGranted: true });
  }

  function prepare(input, { principal } = {}) {
    const command = normalizeCommand(input);
    const ownerId = resolveOwner(ownerResolver, principal);
    const issuedAt = currentTime();
    const nonceBytes = Buffer.from(randomBytesImpl(NONCE_BYTES));
    if (nonceBytes.length !== NONCE_BYTES) fail('INVALID_GITHUB_WRITE_APPROVAL_NONCE');
    const payload = {
      v: 1,
      n: nonceBytes.toString('base64url'),
      e: issuedAt + ttlMs,
      o: ownerId,
      d: commandDigest(command)
    };
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const approvalToken = `${TOKEN_PREFIX}.${body}.${sign(approvalSecret, body).toString('base64url')}`;
    return Object.freeze({
      approvalToken,
      expiresAt: new Date(payload.e).toISOString(),
      command
    });
  }

  function consume(input, { principal, approvalToken } = {}) {
    const command = normalizeCommand(input);
    const ownerId = resolveOwner(ownerResolver, principal);
    const at = currentTime();
    cleanup(at);
    const payload = parseToken(approvalToken, approvalSecret);
    if (payload.e <= at) fail('GITHUB_WRITE_APPROVAL_EXPIRED');
    if (payload.e > at + MAX_TTL_MS || payload.o !== ownerId || payload.d !== commandDigest(command)) {
      fail('GITHUB_WRITE_APPROVAL_MISMATCH');
    }
    if (usedNonces.has(payload.n)) fail('GITHUB_WRITE_APPROVAL_REPLAYED');
    usedNonces.set(payload.n, payload.e);
    return command;
  }

  return Object.freeze({ prepare, consume });
}

export const GITHUB_WRITE_APPROVAL_LIMITS = Object.freeze({
  defaultTtlMs: DEFAULT_TTL_MS,
  maxTtlMs: MAX_TTL_MS
});
