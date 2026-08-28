const OPERATIONS = Object.freeze(['user.get', 'user.profile', 'user.capabilities', 'design.list', 'design.get']);
const OPERATION_SET = new Set(OPERATIONS);
const TOP_FIELDS = new Set(['operation', 'params']);
const PARAM_FIELDS = new Set(['query', 'continuation', 'ownership', 'sortBy', 'limit', 'designId']);

function invalid(reason) {
  const error = new Error(`INVALID_CANVA_READ_TOOL:${reason}`);
  error.code = 'INVALID_CANVA_READ_TOOL';
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

export function createCanvaReadToolBoundary({ readClient, ownerResolver } = {}) {
  if (typeof readClient?.read !== 'function') throw invalid('readClient');
  if (typeof ownerResolver?.resolve !== 'function') throw invalid('ownerResolver');

  async function execute(args, { principal, signal = null } = {}) {
    const normalized = normalizeArgs(args);
    const ownership = ownerResolver.resolve(principal);
    if (!ownership || typeof ownership.ownerId !== 'string' || !ownership.ownerId) throw invalid('owner');
    return readClient.read({
      ownerId: ownership.ownerId,
      operation: normalized.operation,
      params: normalized.params,
      signal
    });
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
            ownership: Object.freeze({ type: 'string', enum: Object.freeze(['any', 'owned', 'shared']) }),
            sortBy: Object.freeze({ type: 'string', enum: Object.freeze(['relevance', 'modified_descending', 'modified_ascending', 'title_descending', 'title_ascending']) }),
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
