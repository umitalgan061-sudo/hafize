import type { PlanStep } from './orchestrator.ts';
type Json = Record<string, unknown>;
export const DEFAULT_STEP_TIMEOUT_MS = 90_000;
export const REASON_TOOL = 'reason';
const ID = /^[a-z][a-z0-9_-]{0,31}$/;

export class OrchestratorError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'OrchestratorError'; this.code = code; this.status = status; }
}

export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(Math.max(Math.trunc(number), min), max) : fallback;
}

/** Validates a plan: unique ids, known tools, existing dependencies, no cycles. */
export function validatePlan(raw: unknown, toolNames: ReadonlySet<string>, maxSteps: number): PlanStep[] {
  if (!Array.isArray(raw) || !raw.length) throw new OrchestratorError('PLAN_EMPTY');
  if (raw.length > maxSteps) throw new OrchestratorError('PLAN_TOO_LARGE');
  const steps: PlanStep[] = raw.map((item, index) => {
    const step = item && typeof item === 'object' ? item as Json : {};
    const id = String(step.id || `s${index + 1}`).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32) || `s${index + 1}`;
    const tool = String(step.tool || '');
    if (!ID.test(id)) throw new OrchestratorError('PLAN_INVALID_STEP_ID');
    if (tool !== REASON_TOOL && !toolNames.has(tool)) throw new OrchestratorError(`PLAN_UNKNOWN_TOOL:${tool.slice(0, 40)}`);
    const retry = step.retryPolicy && typeof step.retryPolicy === 'object' ? step.retryPolicy as Json : {};
    return {
      id,
      title: String(step.title || tool).replace(/\s+/g, ' ').slice(0, 160),
      tool,
      args: step.args && typeof step.args === 'object' && !Array.isArray(step.args) ? step.args as Json : {},
      dependsOn: Array.isArray(step.dependsOn) ? [...new Set(step.dependsOn.map((dep) => String(dep).toLowerCase()))] : [],
      retryPolicy: { maxAttempts: clampInt(retry.maxAttempts, 2, 1, 4), backoffMs: clampInt(retry.backoffMs, 800, 0, 10_000) },
      timeoutMs: clampInt(step.timeoutMs, DEFAULT_STEP_TIMEOUT_MS, 2_000, 180_000),
      checkpoint: step.checkpoint !== false
    };
  });
  // A generated-result reference is also a scheduling dependency, even when the planner
  // omitted it from dependsOn. This prevents a consumer racing its producer.
  for (const [index, step] of steps.entries()) {
    const dependencies = new Set(step.dependsOn);
    function collect(value: unknown): void {
      if (typeof value === 'string') {
        for (const match of value.matchAll(/\{\{\s*([a-z0-9_-]+)(?:\.[a-zA-Z0-9_-]+)*\s*\}\}/g)) dependencies.add(match[1]!);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(collect);
      }
    }
    collect(step.args);
    steps[index] = { ...step, dependsOn: [...dependencies] };
  }
  const ids = new Set<string>();
  for (const step of steps) {
    if (ids.has(step.id)) throw new OrchestratorError('PLAN_DUPLICATE_STEP_ID');
    ids.add(step.id);
  }
  for (const step of steps) for (const dep of step.dependsOn) if (!ids.has(dep) || dep === step.id) throw new OrchestratorError(`PLAN_UNKNOWN_DEPENDENCY:${dep}`);
  // Kahn's algorithm: every step must become ready at some point.
  const indegree = new Map(steps.map((step) => [step.id, step.dependsOn.length]));
  const queue = steps.filter((step) => !step.dependsOn.length).map((step) => step.id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited += 1;
    for (const step of steps) if (step.dependsOn.includes(id)) {
      indegree.set(step.id, indegree.get(step.id)! - 1);
      if (indegree.get(step.id) === 0) queue.push(step.id);
    }
  }
  if (visited !== steps.length) throw new OrchestratorError('PLAN_HAS_CYCLE');
  return steps;
}

/** Replaces {{stepId}} placeholders in string args with that step's (truncated) output. */
export function bindArgs(args: Json, outputs: Readonly<Record<string, unknown>>): Json {
  const render = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const pattern = /\{\{\s*([a-z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)\s*\}\}/g;
      function resolve(path: string, original: string): unknown {
        let item: unknown = outputs;
        for (const key of path.split('.')) {
          if (!item || typeof item !== 'object' || !Object.hasOwn(item, key)) {
            if (path.includes('.')) throw new OrchestratorError('PLAN_RESULT_PATH_MISSING:' + path);
            return original;
          }
          item = (item as Json)[key];
        }
        return item;
      }
      const first = pattern.exec(value);
      if (first && first[0] === value) return resolve(first[1]!, value);
      return value.replace(pattern, (match, path: string) => summarize(resolve(path, match), 2_000));
    }
    if (Array.isArray(value)) return value.map(render);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, render(item)]));
    return value;
  };
  return render(args) as Json;
}

export function summarize(value: unknown, max = 1_500): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

