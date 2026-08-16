function fail(field) {
  throw new Error(`INVALID_DELEGATION_LIFECYCLE:${field}`);
}

function boundedLimit(value) {
  return Number.isInteger(value) ? Math.min(Math.max(value, 1), 16) : 1;
}

function validSignal(signal) {
  return signal == null || (typeof signal === 'object' && typeof signal.aborted === 'boolean' && typeof signal.addEventListener === 'function');
}

export function createDelegationLifecycle({ maxParallelAgents = 1, parentSignal = null } = {}) {
  if (!validSignal(parentSignal)) fail('parentSignal');
  const limit = boundedLimit(maxParallelAgents);
  const active = new Map();
  let closed = false;

  function release(taskId) {
    const entry = active.get(taskId);
    if (!entry) return false;
    for (const cleanup of entry.cleanups) cleanup();
    active.delete(taskId);
    return true;
  }

  function acquire(taskId, { signal = null } = {}) {
    if (typeof taskId !== 'string' || !taskId.trim()) fail('taskId');
    if (!validSignal(signal)) fail('signal');
    if (closed) return { ok: false, error: 'DELEGATION_LIFECYCLE_CLOSED' };
    if (active.has(taskId)) return { ok: false, error: 'DELEGATION_TASK_ALREADY_ACTIVE' };
    if (active.size >= limit) return { ok: false, error: 'DELEGATION_PARALLEL_LIMIT_EXCEEDED' };

    const controller = new AbortController();
    const cleanups = [];
    const bind = (source) => {
      if (!source) return;
      if (source.aborted) {
        controller.abort(source.reason);
        return;
      }
      const onAbort = () => controller.abort(source.reason);
      source.addEventListener('abort', onAbort, { once: true });
      cleanups.push(() => source.removeEventListener?.('abort', onAbort));
    };
    bind(parentSignal);
    bind(signal);
    active.set(taskId, { controller, cleanups });

    return {
      ok: true,
      signal: controller.signal,
      release: () => release(taskId)
    };
  }

  function cancel(taskId, reason = 'DELEGATION_CANCELLED') {
    const entry = active.get(taskId);
    if (!entry) return false;
    if (!entry.controller.signal.aborted) entry.controller.abort(reason);
    return true;
  }

  function cancelAll(reason = 'DELEGATION_CANCELLED') {
    closed = true;
    for (const entry of active.values()) {
      if (!entry.controller.signal.aborted) entry.controller.abort(reason);
    }
    return active.size;
  }

  function snapshot() {
    return Object.freeze({
      active: active.size,
      maxParallelAgents: limit,
      closed,
      taskIds: Object.freeze([...active.keys()])
    });
  }

  return Object.freeze({ acquire, cancel, cancelAll, release, snapshot });
}
