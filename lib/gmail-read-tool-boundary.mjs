import { normalizeRequestInput } from './request-input.mjs';

const OPERATIONS = Object.freeze(['profile.get', 'message.list', 'message.get']);
const OPERATION_SET = new Set(OPERATIONS);
const TOP_FIELDS = new Set(['operation', 'params']);
const PARAM_FIELDS = new Set(['query', 'pageToken', 'maxResults', 'includeSpamTrash', 'messageId', 'format']);

function failInvalid(reason) {
  throw invalid(reason);
}
function invalid(reason) {
  const error = new Error(`INVALID_GMAIL_READ_TOOL:${reason}`);
  error.code = 'INVALID_GMAIL_READ_TOOL';
  return error;
}
function normalizeArgs(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw invalid('args');
  for (const field of Object.keys(value)) if (!TOP_FIELDS.has(field)) throw invalid(`unknown_field:${field}`);
  if (typeof value.operation !== 'string' || !OPERATION_SET.has(value.operation)) throw invalid('operation');
  if (value.params !== undefined) {
    if (!value.params || Array.isArray(value.params) || typeof value.params !== 'object') throw invalid('params');
    for (const field of Object.keys(value.params)) if (!PARAM_FIELDS.has(field)) throw invalid(`params.${field}`);
  }
  return { operation: value.operation, params: value.params === undefined ? undefined : structuredClone(value.params) };
}

export function createGmailReadToolBoundary(options) {
  const { readClient, ownerResolver } = normalizeRequestInput(options, failInvalid, 'options');
  if (typeof readClient?.read !== 'function') throw invalid('readClient');
  if (typeof ownerResolver?.resolve !== 'function') throw invalid('ownerResolver');
  async function execute(args, context) {
    const { principal } = normalizeRequestInput(context, failInvalid, 'context');
    const normalized = normalizeArgs(args);
    const ownership = ownerResolver.resolve(principal);
    if (!ownership || typeof ownership.ownerId !== 'string' || !ownership.ownerId) throw invalid('owner');
    return readClient.read({ ownerId: ownership.ownerId, operation: normalized.operation, params: normalized.params });
  }
  return Object.freeze({ execute });
}

export const GMAIL_READ_TOOL_DEFINITION = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'gmail_read',
    description: 'Bağlı Gmail hesabından salt-okunur profil veya mesaj bilgisi getirir. Gönderme, silme, etiket değiştirme ya da serbest URL çağrısı yapmaz.',
    parameters: Object.freeze({
      type: 'object',
      properties: Object.freeze({
        operation: Object.freeze({ type: 'string', enum: OPERATIONS }),
        params: Object.freeze({
          type: 'object',
          properties: Object.freeze({
            query: Object.freeze({ type: 'string', maxLength: 512 }),
            pageToken: Object.freeze({ type: 'string', maxLength: 2048 }),
            maxResults: Object.freeze({ type: 'integer', minimum: 1, maximum: 100 }),
            includeSpamTrash: Object.freeze({ type: 'boolean' }),
            messageId: Object.freeze({ type: 'string', maxLength: 256 }),
            format: Object.freeze({ type: 'string', enum: Object.freeze(['minimal', 'metadata', 'full']) })
          }),
          additionalProperties: false
        })
      }),
      required: Object.freeze(['operation']),
      additionalProperties: false
    })
  })
});