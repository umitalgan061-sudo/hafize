// TypeScript migration wave 2026-10.
// Skill SDK CLI and eval harness stubs.
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function createSkillSDK() {
  function scaffold({ name, riskLevel = 'low' }) {
    if (!name) fail('INVALID_SKILL_NAME');
    return Object.freeze({
      name,
      riskLevel,
      manifest: {
        name,
        description: '',
        triggers: [],
        arguments: [],
        allowedTools: [],
        requiredScopes: [],
        sideEffects: { mutates: false },
        riskLevel,
        rollbackHint: ''
      },
      createdAt: Date.now()
    });
  }

  function validate(manifest) {
    if (!manifest || !manifest.name) return false;
    return true;
  }

  return Object.freeze({ scaffold, validate });
}

export function createEvalHarness({ tests = [] } = {}) {
  async function run({ skillRuntime, agent }) {
    const results = [];
    for (const t of tests) {
      try {
        const out = await skillRuntime.resolveForAgent({ agent, skillId: t.skillId, args: t.args });
        results.push({ test: t.id, ok: !!out, output: out });
      } catch (e) {
        results.push({ test: t.id, ok: false, error: e.message });
      }
    }
    return Object.freeze({ results, passed: results.filter(r => r.ok).length, total: results.length });
  }

  return Object.freeze({ run });
}
