// TypeScript migration wave 2026-10.
// Local-first model artifacts and sync engine stub.
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function createModelArtifactStore({ dir = './models' } = {}) {
  function register({ modelId, version, checksum, sizeBytes }) {
    if (!modelId) fail('INVALID_MODEL_ID');
    return Object.freeze({ modelId, version, checksum, sizeBytes, dir, registeredAt: Date.now() });
  }

  function list() {
    return Object.freeze([]);
  }

  return Object.freeze({ register, list });
}

export function createSyncEngine({ provider = 'local' } = {}) {
  function push({ ownerId, payload }) {
    // Stub CRDT sync
    return Object.freeze({ ok: true, provider, ownerId, pushedAt: Date.now() });
  }

  function pull({ ownerId, since }) {
    return Object.freeze({ ok: true, ownerId, since, items: [] });
  }

  return Object.freeze({ push, pull });
}
