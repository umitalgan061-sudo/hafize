import { createHash, createHmac, randomBytes as cryptoRandomBytes, timingSafeEqual } from 'node:crypto';
import { normalizeGmailSendRequest } from './gmail-send-contract.mjs';

const TOKEN_VERSION = 1;
const DEFAULT_TTL_MS = 120_000;
const MAX_TTL_MS = 5 * 60_000;
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeOwnerId(value) {
  const ownerId = typeof value === 'string' ? value.trim() : '';
  if (!OWNER_PATTERN.test(ownerId)) fail('INVALID_GMAIL_SEND_APPROVAL_OWNER');
  return ownerId;
}

function normalizeMessage(message) {
  return normalizeGmailSendRequest({
    ...message,
    explicitUserIntent: true
  }, { approvalGranted: true });
}

function messageFingerprint(ownerId, command) {
  const canonical = JSON.stringify({
    ownerId,
    to: command.to,
    subject: command.subject,
    text: command.text
  });
  return createHash('sha256').update(canonical, 'utf8').digest('base64url');
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(encoded) {
  try {
    const raw = Buffer.from(encoded, 'base64url').toString('utf8');
    const payload = JSON.parse(raw);
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') fail('INVALID_GMAIL_SEND_APPROVAL_TOKEN');
    return payload;
  } catch (error) {
    if (error?.code === 'INVALID_GMAIL_SEND_APPROVAL_TOKEN') throw error;
    fail('INVALID_GMAIL_SEND_APPROVAL_TOKEN');
  }
}

function signature(secret, encodedPayload) {
  return createHmac('sha256', secret).update(encodedPayload, 'utf8').digest();
}

function parseToken(token) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 4096) fail('INVALID_GMAIL_SEND_APPROVAL_TOKEN');
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) fail('INVALID_GMAIL_SEND_APPROVAL_TOKEN');
  let receivedSignature;
  try {
    receivedSignature = Buffer.from(parts[1], 'base64url');
  } catch {
    fail('INVALID_GMAIL_SEND_APPROVAL_TOKEN');
  }
  if (receivedSignature.length !== 32) fail('INVALID_GMAIL_SEND_APPROVAL_TOKEN');
  return { encodedPayload: parts[0], receivedSignature };
}

export function createGmailSendApprovalService({
  secret,
  now = () => Date.now(),
  ttlMs = DEFAULT_TTL_MS,
  randomBytes = cryptoRandomBytes
} = {}) {
  if (!Buffer.isBuffer(secret) || secret.length < 32) fail('INVALID_GMAIL_SEND_APPROVAL_SECRET');
  if (typeof now !== 'function' || typeof randomBytes !== 'function') fail('INVALID_GMAIL_SEND_APPROVAL_CONFIG');
  if (!Number.isInteger(ttlMs) || ttlMs < 10_000 || ttlMs > MAX_TTL_MS) fail('INVALID_GMAIL_SEND_APPROVAL_TTL');

  const consumedNonces = new Map();

  function prune(timestamp) {
    for (const [nonce, expiresAt] of consumedNonces) {
      if (expiresAt <= timestamp) consumedNonces.delete(nonce);
    }
  }

  function issue({ ownerId, message, userConfirmed } = {}) {
    if (userConfirmed !== true) fail('GMAIL_SEND_USER_CONFIRMATION_REQUIRED');
    const owner = normalizeOwnerId(ownerId);
    const command = normalizeMessage(message);
    const issuedAt = Number(now());
    if (!Number.isFinite(issuedAt)) fail('INVALID_GMAIL_SEND_APPROVAL_CLOCK');
    const nonceBytes = randomBytes(18);
    if (!Buffer.isBuffer(nonceBytes) || nonceBytes.length !== 18) fail('INVALID_GMAIL_SEND_APPROVAL_NONCE');
    const payload = Object.freeze({
      v: TOKEN_VERSION,
      iat: issuedAt,
      exp: issuedAt + ttlMs,
      nonce: nonceBytes.toString('base64url'),
      fingerprint: messageFingerprint(owner, command)
    });
    const encodedPayload = encodePayload(payload);
    return `${encodedPayload}.${signature(secret, encodedPayload).toString('base64url')}`;
  }

  function consume({ token, ownerId, message } = {}) {
    const owner = normalizeOwnerId(ownerId);
    const command = normalizeMessage(message);
    const timestamp = Number(now());
    if (!Number.isFinite(timestamp)) fail('INVALID_GMAIL_SEND_APPROVAL_CLOCK');
    prune(timestamp);

    const { encodedPayload, receivedSignature } = parseToken(token);
    const expectedSignature = signature(secret, encodedPayload);
    if (!timingSafeEqual(receivedSignature, expectedSignature)) fail('INVALID_GMAIL_SEND_APPROVAL_SIGNATURE');
    const payload = decodePayload(encodedPayload);
    if (payload.v !== TOKEN_VERSION || !Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) {
      fail('INVALID_GMAIL_SEND_APPROVAL_TOKEN');
    }
    if (typeof payload.nonce !== 'string' || payload.nonce.length < 16 || typeof payload.fingerprint !== 'string') {
      fail('INVALID_GMAIL_SEND_APPROVAL_TOKEN');
    }
    if (payload.iat > timestamp + 5_000 || payload.exp <= timestamp || payload.exp - payload.iat > MAX_TTL_MS) {
      fail('GMAIL_SEND_APPROVAL_EXPIRED');
    }
    if (consumedNonces.has(payload.nonce)) fail('GMAIL_SEND_APPROVAL_ALREADY_USED');
    const expectedFingerprint = messageFingerprint(owner, command);
    const actualFingerprint = Buffer.from(payload.fingerprint, 'utf8');
    const expectedFingerprintBytes = Buffer.from(expectedFingerprint, 'utf8');
    if (actualFingerprint.length !== expectedFingerprintBytes.length || !timingSafeEqual(actualFingerprint, expectedFingerprintBytes)) {
      fail('GMAIL_SEND_APPROVAL_MISMATCH');
    }
    consumedNonces.set(payload.nonce, payload.exp);
    return Object.freeze({ approved: true, expiresAt: payload.exp });
  }

  return Object.freeze({ issue, consume });
}

export const GMAIL_SEND_APPROVAL_DEFAULT_TTL_MS = DEFAULT_TTL_MS;