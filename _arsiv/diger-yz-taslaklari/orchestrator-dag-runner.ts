// TypeScript migration wave 2026-10.
// Orchestrator DAG runner with state machine, checkpoint, budget guards.
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function createOrchestratorRunner({ maxSteps = 100, maxWallTimeMs = 600000, maxTokenCost = Infinity, now = () => Date.now() } = {}) {
  const state = {
    steps: [],
    completed: new Set(),
    status: 'pending',
    startedAt: null,
    checkpoint: null
  };

  function plan(steps) {
    if (!Array.isArray(steps)) fail('INVALID_ORCHESTRATOR_PLAN');
    state.steps = steps.map(s => ({ ...s, status: 'pending' }));
    state.status = 'planned';
    return Object.freeze([...state.steps]);
  }

  function checkpoint() {
    state.checkpoint = {
      steps: state.steps,
      completed: [...state.completed],
      timestamp: now()
    };
    return state.checkpoint;
  }

  async function run({ critic } = {}) {
    if (state.status !== 'planned') fail('ORCHESTRATOR_NOT_PLANNED');
    state.status = 'running';
    state.startedAt = now();
    let stepIndex = 0;
    while (stepIndex < state.steps.length) {
      if (now() - state.startedAt > maxWallTimeMs) throw new Error('ORCHESTRATOR_BUDGET_WALL_TIME');
      if (state.completed.size >= maxSteps) throw new Error('ORCHESTRATOR_BUDGET_STEPS');
      const step = state.steps[stepIndex];
      if (step.dependsOn && !step.dependsOn.every(d => state.completed.has(d))) {
        stepIndex++;
        continue;
      }
      step.status = 'running';
      // Stub execution
      step.status = 'succeeded';
      state.completed.add(step.id);
      if (critic) {
        const decision = await critic({ step, state });
        if (decision === 'abort') { state.status = 'aborted'; break; }
        if (decision === 'revise') { /* revise plan */ }
      }
      stepIndex++;
    }
    state.status = 'succeeded';
    checkpoint();
    return Object.freeze({ status: state.status, steps: state.steps });
  }

  function resume(checkpoint) {
    if (!checkpoint) fail('INVALID_ORCHESTRATOR_CHECKPOINT');
    state.steps = checkpoint.steps;
    state.completed = new Set(checkpoint.completed);
    state.status = 'running';
    return state;
  }

  return Object.freeze({ plan, run, checkpoint, resume });
}
