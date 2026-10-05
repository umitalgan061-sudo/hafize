import type { GenerationPhase, GenerationSnapshot, GenerationStopReason } from './generation-control.ts';

export type GenerationLifecycleEvent =
  | 'started'
  | 'progress'
  | 'completed'
  | 'aborted'
  | 'failed';

export interface GenerationLifecycleDetail {
  readonly event: GenerationLifecycleEvent;
  readonly snapshot: GenerationSnapshot;
  readonly runId: number;
  readonly phase: GenerationPhase;
  readonly stopReason: GenerationStopReason | null;
}

export const GENERATION_LIFECYCLE_EVENT = 'hafize:generation-lifecycle';

const MAX_DETAIL_TEXT = 120;

export function normalizeLifecycleDetail(snapshot: GenerationSnapshot): GenerationLifecycleDetail {
  const event: GenerationLifecycleEvent =
    snapshot.phase === 'active'
      ? (snapshot.startedAt === null ? 'progress' : 'progress')
      : snapshot.phase === 'completed'
        ? 'completed'
        : snapshot.phase === 'aborted'
          ? 'aborted'
          : snapshot.phase === 'failed'
            ? 'failed'
            : 'progress';

  return Object.freeze({
    event,
    snapshot,
    runId: Math.max(0, Math.floor(snapshot.runId)),
    phase: snapshot.phase,
    stopReason: snapshot.stopReason ? String(snapshot.stopReason).slice(0, MAX_DETAIL_TEXT) as GenerationStopReason : null
  });
}

export function emitGenerationLifecycle(
  target: EventTarget,
  snapshot: GenerationSnapshot,
  eventType: GenerationLifecycleEvent
): boolean {
  try {
    const detail = Object.freeze({
      event: eventType,
      snapshot,
      runId: Math.max(0, Math.floor(snapshot.runId)),
      phase: snapshot.phase,
      stopReason: snapshot.stopReason
    });
    target.dispatchEvent(new CustomEvent(GENERATION_LIFECYCLE_EVENT, { detail }));
    return true;
  } catch {
    return false;
  }
}
