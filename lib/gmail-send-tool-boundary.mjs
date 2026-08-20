const ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const OWNER_PATTERN = /^owner_[A-Za-z0-9_-]{43}$/;

function invalid(reason) {
  const error = new Error(`INVALID_GMAIL_SEND_TOOL:${reason}`);
  error.code = 'INVALID_GMAIL_SEND_TOOL';
  return error;
}

function sanitizeReceipt(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw invalid('receipt');
  const messageId = typeof value.messageId === 'string' ? value.messageId.trim() : '';
  if (!ID_PATTERN.test(messageId)) throw invalid('receipt.messageId');
  const receipt = { sent: true, messageId };
  if (value.threadId !== undefined) {
    const threadId = typeof value.threadId === 'string' ? value.threadId.trim() : '';
    if (!ID_PATTERN.test(threadId)) throw invalid('receipt.threadId');
    receipt.threadId = threadId;
  }
  return Object.freeze(receipt);
}

function resolveOwner(ownerResolver, principal) {
  const ownership = ownerResolver.resolve(principal);
  if (!ownership || typeof ownership.ownerId !== 'string' || !OWNER_PATTERN.test(ownership.ownerId)) throw invalid('owner');
  return ownership.ownerId;
}

export function createGmailSendToolBoundary({ sendClient, ownerResolver, approvalBoundary } = {}) {
  if (typeof sendClient?.send !== 'function') throw invalid('sendClient');
  if (typeof ownerResolver?.resolve !== 'function') throw invalid('ownerResolver');
  if (typeof approvalBoundary?.prepare !== 'function' || typeof approvalBoundary?.consume !== 'function') throw invalid('approvalBoundary');

  function prepareApproval(args, { principal } = {}) {
    return approvalBoundary.prepare(args, { principal });
  }

  async function execute(args, { principal, approvalToken } = {}) {
    const command = await approvalBoundary.consume(args, { principal, approvalToken });
    const ownerId = resolveOwner(ownerResolver, principal);
    // The single-use approval is deliberately consumed before external send starts.
    // An ambiguous transport failure therefore requires a fresh user approval instead of blind retry.
    const result = await sendClient.send({ ownerId, ...command });
    return sanitizeReceipt(result);
  }

  return Object.freeze({ prepareApproval, execute });
}

export const GMAIL_SEND_TOOL_DEFINITION = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'gmail_send',
    description: 'Bağlı Gmail hesabından yalnız açık kullanıcı niyeti ve trusted backend exact-command onayı sonrasında düz metin e-posta gönderir.',
    parameters: Object.freeze({
      type: 'object',
      properties: Object.freeze({
        to: Object.freeze({ type: 'array', minItems: 1, maxItems: 10, items: Object.freeze({ type: 'string', maxLength: 254 }) }),
        subject: Object.freeze({ type: 'string', minLength: 1, maxLength: 180 }),
        text: Object.freeze({ type: 'string', minLength: 1, maxLength: 50000 }),
        explicitUserIntent: Object.freeze({ type: 'boolean', const: true })
      }),
      required: Object.freeze(['to', 'subject', 'text', 'explicitUserIntent']),
      additionalProperties: false
    })
  })
});
