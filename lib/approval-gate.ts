// Human-in-the-loop gate. A high-risk step (shell command, risky skill, orchestrator step) pauses
// here; the server streams an approval request to the browser and the run continues on the same
// stream once the user answers, or is denied when the time runs out or the request is cancelled.
import { randomUUID } from 'node:crypto';

export interface ApprovalRequest {
  readonly ownerId: string;
  readonly traceId: string;
  readonly kind: string;
  readonly title: string;
  readonly detail: string;
  readonly risk: 'low' | 'medium' | 'high';
  /** Offered consent scopes; "once" is always allowed. */
  readonly modes?: readonly ('once' | 'session' | 'always' | 'never')[];
}
export interface ApprovalDecision {
  readonly approved: boolean;
  readonly mode: 'once' | 'session' | 'always' | 'never';
  readonly reason: 'user' | 'timeout' | 'aborted';
}
export interface PendingApproval {
  readonly id: string;
  readonly event: Readonly<{ id: string; kind: string; title: string; detail: string; risk: string; modes: readonly string[]; expiresAt: number }>;
  readonly decision: Promise<ApprovalDecision>;
}

const MAX_PENDING = 50;

export function createApprovalGate({ timeoutMs = 120_000, now = () => Date.now() }: { readonly timeoutMs?: number; readonly now?: () => number } = {}) {
  const pending = new Map<string, { ownerId: string; settle: (decision: ApprovalDecision) => void }>();

  function request(input: ApprovalRequest, signal?: AbortSignal): PendingApproval {
    if (pending.size >= MAX_PENDING) throw new Error('APPROVAL_QUEUE_FULL');
    const id = randomUUID();
    const modes = Object.freeze(['once', ...(input.modes || []).filter((mode) => mode !== 'once')]);
    const event = Object.freeze({
      id,
      kind: String(input.kind).slice(0, 60),
      title: String(input.title).slice(0, 200),
      detail: String(input.detail).slice(0, 4_000),
      risk: input.risk,
      modes,
      expiresAt: now() + timeoutMs
    });
    const decision = new Promise<ApprovalDecision>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const settle = (value: ApprovalDecision) => {
        if (!pending.has(id)) return;
        pending.delete(id);
        if (timer) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(Object.freeze(value));
      };
      const onAbort = () => settle({ approved: false, mode: 'once', reason: 'aborted' });
      pending.set(id, { ownerId: input.ownerId, settle });
      timer = setTimeout(() => settle({ approved: false, mode: 'once', reason: 'timeout' }), timeoutMs);
      timer.unref?.();
      if (signal?.aborted) onAbort();
      else signal?.addEventListener('abort', onAbort, { once: true });
    });
    return { id, event, decision };
  }

  /** Applies the user's answer; only the owner who started the run can answer it. */
  function resolve(id: string, ownerId: string, answer: { readonly approved: boolean; readonly mode?: unknown }): boolean {
    const entry = pending.get(id);
    if (!entry || entry.ownerId !== ownerId) return false;
    const mode = ['once', 'session', 'always', 'never'].includes(String(answer.mode)) ? answer.mode as ApprovalDecision['mode'] : 'once';
    entry.settle({ approved: answer.approved === true && mode !== 'never', mode, reason: 'user' });
    return true;
  }

  return Object.freeze({ request, resolve, get size() { return pending.size; } });
}
export type ApprovalGate = ReturnType<typeof createApprovalGate>;
