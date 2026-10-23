// TypeScript migration wave 2026-10.
// Expert agent registry and router stub.
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function createAgentRegistry() {
  const agents = new Map();

  function register(card) {
    if (!card || typeof card !== 'object' || !card.agentId) fail('INVALID_AGENT_CARD');
    agents.set(card.agentId, Object.freeze({ ...card, registeredAt: Date.now() }));
  }

  function resolve(capabilityQuery) {
    const results = [];
    for (const card of agents.values()) {
      if (card.capabilities && card.capabilities.includes(capabilityQuery)) results.push(card.agentId);
    }
    return Object.freeze(results);
  }

  function healthCheck(agentId) {
    const card = agents.get(agentId);
    if (!card) return { ok: false, reason: 'unknown' };
    return { ok: true, card };
  }

  return Object.freeze({ register, resolve, healthCheck, list: () => [...agents.values()] });
}

export function createAgentRouter({ registry, validator } = {}) {
  async function delegate({ agentId, task, context, budget } = {}) {
    if (!agentId) fail('INVALID_DELEGATION_TARGET');
    const health = registry?.healthCheck(agentId);
    if (!health?.ok) return { status: 'failed', error: 'agent_unavailable' };
    // Stub delegation
    const result = { output: 'stub', tokensUsed: 0 };
    if (validator) {
      const valid = validator(result);
      if (!valid) return { status: 'failed', error: 'validation_failed' };
    }
    return Object.freeze({ status: 'succeeded', result, tokensUsed: result.tokensUsed, traceId: 'stub-trace' });
  }

  return Object.freeze({ delegate });
}
