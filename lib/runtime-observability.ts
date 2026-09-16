export type RequestOutcome = 'ok' | 'client_error' | 'upstream_error' | 'server_error' | 'aborted';
export type RuntimeSnapshot = Readonly<{ startedAt: string; requests: number; completed: number; aborted: number; errors: number; totalDurationMs: number; active: number; peakActive: number; outcomes: Readonly<Record<RequestOutcome, number>> }>;

type Mutable = { startedAt: string; requests: number; completed: number; aborted: number; errors: number; totalDurationMs: number; active: number; peakActive: number; outcomes: Record<RequestOutcome, number> };
const now = () => performance.now();

export function createRuntimeObservability(clock = () => new Date().toISOString()) {
  const state: Mutable = { startedAt: clock(), requests: 0, completed: 0, aborted: 0, errors: 0, totalDurationMs: 0, active: 0, peakActive: 0, outcomes: { ok: 0, client_error: 0, upstream_error: 0, server_error: 0, aborted: 0 } };
  const begins = new Map<symbol, number>();
  return Object.freeze({
    begin() { const token = Symbol('request'); begins.set(token, now()); state.requests += 1; state.active += 1; state.peakActive = Math.max(state.peakActive, state.active); return token; },
    end(token: symbol, outcome: RequestOutcome) { const started = begins.get(token); if (started === undefined) return; begins.delete(token); state.active = Math.max(0, state.active - 1); state.completed += 1; state.totalDurationMs += Math.max(0, now() - started); state.outcomes[outcome] += 1; if (outcome === 'aborted') state.aborted += 1; if (outcome === 'client_error' || outcome === 'upstream_error' || outcome === 'server_error') state.errors += 1; },
    snapshot(): RuntimeSnapshot { return Object.freeze({ ...state, outcomes: Object.freeze({ ...state.outcomes }) }); },
    reset() { state.requests = 0; state.completed = 0; state.aborted = 0; state.errors = 0; state.totalDurationMs = 0; state.active = 0; state.peakActive = 0; for (const key of Object.keys(state.outcomes) as RequestOutcome[]) state.outcomes[key] = 0; begins.clear(); }
  });
}

export function averageLatencyMs(snapshot: RuntimeSnapshot): number { return snapshot.completed ? Number((snapshot.totalDurationMs / snapshot.completed).toFixed(2)) : 0; }
export function healthFromSnapshot(snapshot: RuntimeSnapshot): 'healthy' | 'degraded' { if (snapshot.active > 0 && snapshot.errors > snapshot.completed / 2) return 'degraded'; return 'healthy'; }
