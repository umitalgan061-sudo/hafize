const OPERATIONS = ['user.get', 'user.profile', 'user.capabilities', 'design.list', 'design.get'] as const;
const OWNERSHIP = ['any', 'owned', 'shared'] as const;
const SORTS = ['relevance', 'modified_descending', 'modified_ascending', 'title_descending', 'title_ascending'] as const;
const FORMATS = ['minimal', 'metadata', 'full'] as const;
const TOP_FIELDS = new Set(['operation', 'params']);
const PARAM_FIELDS = new Set(['query', 'continuation', 'ownership', 'sortBy', 'limit', 'designId']);

export interface CanvaReadClient {
  readonly read: (input: { readonly ownerId: string; readonly operation: CanvaOperation; readonly params?: Record<string, unknown> }) => Promise<unknown>;
}
export interface CanvaOwnerResolver {
  readonly resolve: (principal: unknown) => { readonly ownerId?: unknown } | null | undefined;
}
export type CanvaOperation = typeof OPERATIONS[number];

export class CanvaReadToolError extends Error {
  readonly code = 'INVALID_CANVA_READ_TOOL';
  constructor(reason: string) { super(`INVALID_CANVA_READ_TOOL:${reason}`); this.name = 'CanvaReadToolError'; }
}
function invalid(reason: string): never { throw new CanvaReadToolError(reason); }
function normalizeArgs(value: unknown): { readonly operation: CanvaOperation; readonly params?: Record<string, unknown> } {
  if (!value || Array.isArray(value) || typeof value !== 'object') invalid('args');
  const source = value as Record<string, unknown>;
  for (const field of Object.keys(source)) if (!TOP_FIELDS.has(field)) invalid(`unknown_field:${field}`);
  if (typeof source.operation !== 'string' || !(OPERATIONS as readonly string[]).includes(source.operation)) invalid('operation');
  const rawParams = source.params;
  if (rawParams === undefined) return { operation: source.operation as CanvaOperation };
  if (!rawParams || Array.isArray(rawParams) || typeof rawParams !== 'object') invalid('params');
  const params = rawParams as Record<string, unknown>;
  for (const field of Object.keys(params)) if (!PARAM_FIELDS.has(field)) invalid(`params.${field}`);
  return { operation: source.operation as CanvaOperation, params: structuredClone(params) };
}
export function createCanvaReadToolBoundary({ readClient, ownerResolver }: {
  readonly readClient: CanvaReadClient;
  readonly ownerResolver: CanvaOwnerResolver;
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
export const CANVA_READ_TOOL_DEFINITION = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'canva_read',
    description: 'Bağlı Canva hesabından salt-okunur kullanıcı veya tasarım bilgisini getirir. Yazma, silme, paylaşma veya serbest URL çağrısı yapmaz.',
    parameters: Object.freeze({
      type: 'object',
      properties: Object.freeze({
        operation: Object.freeze({ type: 'string', enum: OPERATIONS }),
        params: Object.freeze({
          type: 'object',
          properties: Object.freeze({
            query: Object.freeze({ type: 'string', maxLength: 255 }),
            continuation: Object.freeze({ type: 'string', maxLength: 2048 }),
            ownership: Object.freeze({ type: 'string', enum: OWNERSHIP }),
            sortBy: Object.freeze({ type: 'string', enum: SORTS }),
            limit: Object.freeze({ type: 'integer', minimum: 1, maximum: 100 }),
            designId: Object.freeze({ type: 'string', maxLength: 256 })
          }),
          additionalProperties: false
        })
      }),
      required: Object.freeze(['operation']),
      additionalProperties: false
    })
  })
});
