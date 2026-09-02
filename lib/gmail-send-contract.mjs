const TOP_FIELDS = new Set(['to', 'subject', 'text', 'explicitUserIntent']);
const EMAIL_PATTERN = /^[^\s@<>(),;:\\"\[\]]+@[^\s@<>(),;:\\"\[\]]+\.[^\s@<>(),;:\\"\[\]]+$/;
const MAX_RECIPIENTS = 10;
const MAX_SUBJECT_LENGTH = 180;
const MAX_TEXT_LENGTH = 50_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function rejectUnknownFields(input) {
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_GMAIL_SEND_FIELD');
}

function normalizeRecipients(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_RECIPIENTS) {
    fail('INVALID_GMAIL_SEND_RECIPIENTS');
  }
  const recipients = [];
  const seen = new Set();
  for (const item of value) {
    const address = typeof item === 'string' ? item.trim() : '';
    if (!address || address.length > 254 || /[\r\n\0]/.test(address) || !EMAIL_PATTERN.test(address)) {
      fail('INVALID_GMAIL_SEND_RECIPIENT');
    }
    const key = address.toLowerCase();
    if (seen.has(key)) fail('INVALID_GMAIL_SEND_RECIPIENT');
    seen.add(key);
    recipients.push(address);
  }
  return Object.freeze(recipients);
}

function normalizeSubject(value) {
  const subject = typeof value === 'string' ? value.trim() : '';
  if (!subject || subject.length > MAX_SUBJECT_LENGTH || /[\r\n\0]/.test(subject)) fail('INVALID_GMAIL_SEND_SUBJECT');
  return subject;
}

function normalizeText(value) {
  if (typeof value !== 'string') fail('INVALID_GMAIL_SEND_TEXT');
  const text = value.trim();
  if (!text || text.length > MAX_TEXT_LENGTH || text.includes('\0')) fail('INVALID_GMAIL_SEND_TEXT');
  return text;
}

export function normalizeGmailSendRequest(input = {}, options) {
  const { approvalGranted = false } = options ?? {};
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_GMAIL_SEND_REQUEST');
  rejectUnknownFields(input);
  if (input.explicitUserIntent !== true) fail('GMAIL_SEND_EXPLICIT_INTENT_REQUIRED');
  if (approvalGranted !== true) fail('GMAIL_SEND_APPROVAL_REQUIRED');

  return Object.freeze({
    operation: 'message.send',
    to: normalizeRecipients(input.to),
    subject: normalizeSubject(input.subject),
    text: normalizeText(input.text)
  });
}

export const GMAIL_SEND_LIMITS = Object.freeze({
  maxRecipients: MAX_RECIPIENTS,
  maxSubjectLength: MAX_SUBJECT_LENGTH,
  maxTextLength: MAX_TEXT_LENGTH
});
