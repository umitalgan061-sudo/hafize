const CAPABILITY_SCOPES = Object.freeze({
  'profile.read': Object.freeze(['profile:read']),
  'asset.read': Object.freeze(['asset:read']),
  'asset.write': Object.freeze(['asset:write']),
  'design.meta.read': Object.freeze(['design:meta:read']),
  'design.content.read': Object.freeze(['design:content:read']),
  'design.content.write': Object.freeze(['design:content:write'])
});

const ORDER = Object.freeze(Object.keys(CAPABILITY_SCOPES));
const WRITE = new Set(['asset.write', 'design.content.write']);
const FIELDS = new Set(['capabilities', 'explicitUserIntent']);

function fail(reason) {
  throw new Error(`INVALID_CANVA_OAUTH_POLICY:${reason}`);
}

export function normalizeCanvaOAuthRequest(input = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('input');
  for (const field of Object.keys(input)) if (!FIELDS.has(field)) fail(`unknown_field:${field}`);
  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0 || input.capabilities.length > ORDER.length) fail('capabilities');

  const requested = new Set();
  for (const capability of input.capabilities) {
    if (typeof capability !== 'string' || !Object.hasOwn(CAPABILITY_SCOPES, capability)) fail('capability');
    if (requested.has(capability)) fail('duplicate_capability');
    requested.add(capability);
  }
  const capabilities = ORDER.filter((capability) => requested.has(capability));
  const requiresWriteApproval = capabilities.some((capability) => WRITE.has(capability));
  if (requiresWriteApproval && input.explicitUserIntent !== true) fail('explicit_user_intent');
  if (!requiresWriteApproval && input.explicitUserIntent !== undefined && typeof input.explicitUserIntent !== 'boolean') fail('explicit_user_intent');

  const scopes = capabilities.flatMap((capability) => CAPABILITY_SCOPES[capability]);
  return Object.freeze({ provider: 'canva', capabilities: Object.freeze(capabilities), scopes: Object.freeze(scopes), requiresWriteApproval });
}

export function getCanvaOAuthCapabilityScopes() {
  return CAPABILITY_SCOPES;
}
