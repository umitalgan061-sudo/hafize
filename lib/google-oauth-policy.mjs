const CAPABILITY_SCOPES = Object.freeze({
  identity: Object.freeze(['openid', 'email', 'profile']),
  'gmail.read': Object.freeze(['https://www.googleapis.com/auth/gmail.readonly']),
  'gmail.modify': Object.freeze(['https://www.googleapis.com/auth/gmail.modify']),
  'gmail.send': Object.freeze(['https://www.googleapis.com/auth/gmail.send'])
});

const WRITE_CAPABILITIES = new Set(['gmail.modify', 'gmail.send']);
const ALLOWED_FIELDS = new Set(['capabilities', 'explicitUserIntent']);
const CAPABILITY_ORDER = ['identity', 'gmail.read', 'gmail.modify', 'gmail.send'];

function fail(reason) {
  throw new Error(`INVALID_GOOGLE_OAUTH_POLICY:${reason}`);
}

function normalizeCapabilities(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > CAPABILITY_ORDER.length) fail('capabilities');
  const unique = new Set();
  for (const capability of value) {
    if (typeof capability !== 'string' || !Object.hasOwn(CAPABILITY_SCOPES, capability)) fail('capability');
    if (unique.has(capability)) fail('duplicate_capability');
    unique.add(capability);
  }
  return CAPABILITY_ORDER.filter((capability) => unique.has(capability));
}

export function normalizeGoogleOAuthRequest(input = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('input');
  for (const key of Object.keys(input)) if (!ALLOWED_FIELDS.has(key)) fail(`unknown_field:${key}`);

  const capabilities = normalizeCapabilities(input.capabilities);
  const requiresWriteApproval = capabilities.some((capability) => WRITE_CAPABILITIES.has(capability));
  if (requiresWriteApproval && input.explicitUserIntent !== true) fail('explicit_user_intent');
  if (!requiresWriteApproval && input.explicitUserIntent !== undefined && typeof input.explicitUserIntent !== 'boolean') {
    fail('explicit_user_intent');
  }

  const scopes = [];
  const seenScopes = new Set();
  for (const capability of capabilities) {
    for (const scope of CAPABILITY_SCOPES[capability]) {
      if (!seenScopes.has(scope)) {
        seenScopes.add(scope);
        scopes.push(scope);
      }
    }
  }

  return Object.freeze({
    provider: 'google',
    capabilities: Object.freeze(capabilities),
    scopes: Object.freeze(scopes),
    requiresWriteApproval
  });
}

export function getGoogleOAuthCapabilityScopes() {
  return CAPABILITY_SCOPES;
}
