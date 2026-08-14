const API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const MAX_RESPONSE_BYTES = 64 * 1024;

function fail(reason) {
  const error = new Error(`INVALID_GMAIL_SEND:${reason}`);
  error.code = 'INVALID_GMAIL_SEND';
  throw error;
}

function text(value, field, { min = 1, max = 4096 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max || normalized.includes('\0')) fail(field);
  return normalized;
}

function requireSendScope(record) {
  if (!Array.isArray(record.scopes) || !record.scopes.includes(SEND_SCOPE)) {
    const error = new Error('GMAIL_SEND_SCOPE_REQUIRED');
    error.code = 'GMAIL_SEND_SCOPE_REQUIRED';
    throw error;
  }
}

function encodeSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

function encodeRawMessage({ to, subject, text: body }) {
  if (!Array.isArray(to) || to.length < 1 || to.length > 10) fail('to');
  const recipients = to.map((value) => text(value, 'to', { max: 254 }));
  const safeSubject = text(subject, 'subject', { max: 180 });
  const safeBody = text(body, 'text', { max: 50_000 });
  if (recipients.some((value) => /[\r\n]/.test(value)) || /[\r\n]/.test(safeSubject)) fail('headers');
  const source = [
    `To: ${recipients.join(', ')}`,
    `Subject: ${encodeSubject(safeSubject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    safeBody
  ].join('\r\n');
  return Buffer.from(source, 'utf8').toString('base64url');
}

export function createGmailSendClient({ tokenStore, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  if (typeof tokenStore?.load !== 'function') fail('tokenStore');
  if (typeof fetchImpl !== 'function') fail('fetch');
  if (typeof now !== 'function') fail('now');

  async function send({ ownerId, message } = {}) {
    const owner = text(ownerId, 'ownerId', { max: 128 });
    if (!OWNER_PATTERN.test(owner)) fail('ownerId');
    if (!message || Array.isArray(message) || typeof message !== 'object') fail('message');
    const record = await tokenStore.load({ ownerId: owner, provider: 'google' });
    if (!record || Array.isArray(record) || typeof record !== 'object') throw new Error('GMAIL_SEND_REAUTH_REQUIRED');
    requireSendScope(record);
    const tokenType = text(record.tokenType, 'token.tokenType', { max: 32 });
    if (tokenType.toLowerCase() !== 'bearer') fail('token.tokenType');
    const accessToken = text(record.accessToken, 'token.accessToken', { min: 16, max: 4096 });
    const expiresAt = Number(record.expiresAt);
    const timestamp = Number(now());
    if (!Number.isFinite(expiresAt) || !Number.isFinite(timestamp)) fail('token.expiresAt');
    if (expiresAt <= timestamp + 30_000) throw new Error('GMAIL_SEND_REAUTH_REQUIRED');

    const response = await fetchImpl(API_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json'
      },
      redirect: 'error',
      body: JSON.stringify({ raw: encodeRawMessage(message) })
    });
    if (!response?.ok || typeof response.json !== 'function') throw new Error('GMAIL_SEND_FAILED:http');
    const data = await response.json();
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('GMAIL_SEND_FAILED:response');
    const serialized = JSON.stringify(data);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_RESPONSE_BYTES || serialized.includes(accessToken)) {
      throw new Error('GMAIL_SEND_FAILED:response');
    }
    return structuredClone(data);
  }

  return Object.freeze({ send });
}

export const GMAIL_SEND_API_URL = API_URL;
