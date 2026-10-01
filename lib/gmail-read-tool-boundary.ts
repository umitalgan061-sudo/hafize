const OPERATIONS = ['profile.get', 'message.list', 'message.get'] as const;
const FORMATS = ['minimal', 'metadata', 'full'] as const;
const TOP_FIELDS = new Set(['operation', 'params']);
const PARAM_FIELDS = new Set(['query', 'pageToken', 'maxResults', 'includeSpamTrash', 'messageId', 'format']);

export interface GmailReadClient {
  readonly read: (input: { readonly ownerId: string; readonly operation: GmailOperation; readonly params?: Record<string, unknown> }) => Promise<unknown>;
}
export interface GmailOwnerResolver {
  readonly resolve: (principal: unknown) => { readonly ownerId?: unknown } | null | undefined;
}
export type GmailOperation = typeof OPERATIONS[number];

export class GmailReadToolError extends Error {
  readonly code = 'INVALID_GMAIL_READ_TOOL';
  constructor(reason: string) { super(`INVALID_GMAIL_READ_TOOL:${reason}`); this.name = 'GmailReadToolError'; }
}
function invalid(reason: string): never { throw new GmailReadToolError(reason); }
function normalizeArgs(value: unknown): { readonly operation: GmailOperation; readonly params?: Record<string, unknown> } {
  if (!value || Array.isArray(value) || typeof value !== 'object') invalid('args');
  const source = value as Record<string, unknown>;
  for (const field of Object.keys(source)) if (!TOP_FIELDS.has(field)) invalid(`unknown_field:${field}`);
  if (typeof source.operation !== 'string' || !(OPERATIONS as readonly string[]).includes(source.operation)) invalid('operation');
  const rawParams = source.params;
  if (rawParams === undefined) return { operation: source.operation as GmailOperation };
  if (!rawParams || Array.isArray(rawParams) || typeof rawParams !== 'object') invalid('params');
  const params = rawParams as Record<string, unknown>;
  for (const field of Object.keys(params)) if (!PARAM_FIELDS.has(field)) invalid(`params.${field}`);
  return { operation: source.operation as GmailOperation, params: structuredClone(params) };
}
export function createGmailReadToolBoundary({ readClient, ownerResolver }: {
  readonly readClient: GmailReadClient;
  readonly ownerResolver: GmailOwnerResolver;
}): Readonly<{ execute: (args: unknown, context?: { readonly principal?: unknown }) => Promise<unknown> }> {
  if (typeof readClient?.read !== 'function') invalid('readClient');
  if (typeof ownerResolver?.resolve !== 'function') invalid('ownerResolver');
  async function execute(args: unknown, { principal }: { readonly principal?: unknown } = {}): Promise<unknown> {
    const normalized = normalizeArgs(args);
    const ownership = ownerResolver.resolve(principal);
    if (!ownership || typeof ownership.ownerId !== 'string' || !ownership.ownerId) invalid('owner');
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
            format: Object.freeze({ type: 'string', enum: FORMATS })
          }),
          additionalProperties: false
        })
      }),
      required: Object.freeze(['operation']),
      additionalProperties: false
    })
  })
});
