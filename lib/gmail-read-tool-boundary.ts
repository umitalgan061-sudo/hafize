import type { JsonRecord, ReadToolBoundary, ReadToolBoundaryOptions, ReadToolClient, ReadToolOwnerResolver } from './runtime-contracts.ts';

const OPERATIONS = Object.freeze(['profile.get', 'message.list', 'message.get']);
const OPERATION_SET = new Set<string>(OPERATIONS);
const TOP_FIELDS = new Set(['operation', 'params']);
const PARAM_FIELDS = new Set(['query', 'pageToken', 'maxResults', 'includeSpamTrash', 'messageId', 'format']);

interface ReadToolError extends Error { code?: string; }

function invalid(reason: string): ReadToolError {
  const error: ReadToolError = new Error(`INVALID_GMAIL_READ_TOOL:${reason}`);
  error.code = 'INVALID_GMAIL_READ_TOOL';
  return error;
}

function normalizeArgs(value: unknown): { operation: string; params: unknown } {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw invalid('args');
  const record = value as Record<string, unknown>;
  for (const field of Object.keys(record)) if (!TOP_FIELDS.has(field)) throw invalid(`unknown_field:${field}`);
  if (typeof record.operation !== 'string' || !OPERATION_SET.has(record.operation)) throw invalid('operation');
  if (record.params !== undefined) {
    if (!record.params || Array.isArray(record.params) || typeof record.params !== 'object') throw invalid('params');
    for (const field of Object.keys(record.params)) if (!PARAM_FIELDS.has(field)) throw invalid(`params.${field}`);
  }
  return { operation: record.operation, params: record.params === undefined ? undefined : structuredClone(record.params) };
}

export function createGmailReadToolBoundary(options: ReadToolBoundaryOptions = {}): ReadToolBoundary {
  const { readClient, ownerResolver } = options;
  if (!readClient || typeof readClient.read !== 'function') throw invalid('readClient');
  if (!ownerResolver || typeof ownerResolver.resolve !== 'function') throw invalid('ownerResolver');
  const client: ReadToolClient = readClient;
  const resolver: ReadToolOwnerResolver = ownerResolver;

  async function execute(args: unknown, context: { readonly principal?: unknown } = {}): Promise<JsonRecord> {
    const normalized = normalizeArgs(args);
    const ownership = resolver.resolve(context.principal);
    if (!ownership || typeof ownership.ownerId !== 'string' || !ownership.ownerId) throw invalid('owner');
    return client.read({ ownerId: ownership.ownerId, operation: normalized.operation, params: normalized.params });
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
