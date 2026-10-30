// @ts-nocheck
// Rule engine for proactive behaviour: "bu dosya değişince testleri koş", "her sabah 09:00'de
// özet çıkar" gibi kalıpları tanımlar, olayları eşleştirir ve ajanı çalıştırır.
//
// Design notes:
// - Two trigger kinds only: `cron` (time) and `event` (a named signal with a payload). Both are
//   matched by the same rule, so one rule can be fired by either path.
// - A rule is a small, auditable record: id, ownerId, trigger, task, optional guard and a
//   cooldown. Cooldown prevents a noisy watcher from hammering the agent.
// - Execution is delegated to a caller-supplied runner, so this module stays free of agent,
//   telemetry and HTTP concerns and is fully unit-testable.
// - Nothing here can widen permissions: the runner receives the rule's task and is expected to
//   execute it under the owner's own agent policy, exactly like a scheduled task.
const NAME_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
const EVENT_PATTERN = /^[a-z][a-z0-9_.:-]{1,63}$/;
const MAX_RULES_PER_OWNER = 50;
const MAX_TASK_LENGTH = 4_000;
const DEFAULT_COOLDOWN_MS = 60_000;

export class RuleEngineError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'RuleEngineError'; this.code = code; this.status = status }
}

function fail(code: string, status = 400): never {
  throw new RuleEngineError(code, status);
}

export type RuleTrigger =
  | { readonly kind: 'cron'; readonly expression: string }
  | { readonly kind: 'event'; readonly event: string; readonly path?: string };

export interface Rule {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly description: string;
  readonly trigger: RuleTrigger;
  readonly task: string;
  readonly agentId: string;
  readonly cooldownMs: number;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly lastFiredAt: string | null;
  readonly fireCount: number;
}

export interface RuleInput {
  readonly name: string;
  readonly description?: string;
  readonly trigger: RuleTrigger;
  readonly task: string;
  readonly agentId: string;
  readonly cooldownMs?: number;
}

export interface RuleRunContext {
  readonly rule: Rule;
  readonly reason: 'cron' | 'event';
  readonly payload?: Record<string, unknown>;
}

export interface RuleStore {
  readonly load: () => readonly Rule[];
  readonly save: (rule: Rule) => void;
  readonly remove: (id: string) => void;
}

export interface RuleEngineDeps {
  readonly now?: () => Date;
  readonly newId?: () => string;
  /** Runs the rule's task. Must throw or return {ok:false} to signal failure. */
  readonly run: (context: RuleRunContext) => Promise<unknown>;
  /** Optional persistence: without it rules last only as long as the process. */
  readonly store?: RuleStore;
  /** Optional guard: return false to skip this firing (e.g. feature flags). */
  readonly guard?: (context: RuleRunContext) => boolean | Promise<boolean>;
}

/** Parses a 5-field cron expression (minute hour day-of-month month day-of-week). */
export function parseCron(expression: string): { readonly minute: readonly number[]; readonly hour: readonly number[]; readonly dom: readonly number[]; readonly month: readonly number[]; readonly dow: readonly number[] } {
  const parts = String(expression || '').trim().split(/\s+/);
  if (parts.length !== 5) fail('INVALID_RULE_CRON');
  const field = (raw: string, min: number, max: number): number[] => {
    const values = new Set<number>();
    for (const chunk of raw.split(',')) {
      const piece = chunk.trim();
      if (!piece) fail('INVALID_RULE_CRON');
      const stepMatch = /^(\*|\d+-\d+)\/(\d+)$/.exec(piece);
      let base = piece;
      let step = 1;
      if (stepMatch) { base = stepMatch[1]; step = Number(stepMatch[2]); }
      if (step < 1 || step > max) fail('INVALID_RULE_CRON');
      const expand = (from: number, to: number) => { for (let v = from; v <= to; v += step) values.add(v); };
      if (base === '*') expand(min, max);
      else if (/^\d+$/.test(base)) { const v = Number(base); if (v < min || v > max) fail('INVALID_RULE_CRON'); if (!stepMatch) values.add(v); else expand(v, max); }
      else if (/^\d+-\d+$/.test(base)) { const [a, b] = base.split('-').map(Number); if (a < min || b > max || a > b) fail('INVALID_RULE_CRON'); expand(a, b); }
      else fail('INVALID_RULE_CRON');
    }
    if (!values.size) fail('INVALID_RULE_CRON');
    return [...values].sort((x, y) => x - y);
  };
  return {
    minute: field(parts[0], 0, 59),
    hour: field(parts[1], 0, 23),
    dom: field(parts[2], 1, 31),
    month: field(parts[3], 1, 12),
    dow: field(parts[4], 0, 7).map((v) => (v === 7 ? 0 : v))
  };
}

/** True when the given date matches the parsed cron schedule (minute granularity). */
export function cronMatches(parsed: ReturnType<typeof parseCron>, at: Date): boolean {
  return parsed.minute.includes(at.getMinutes())
    && parsed.hour.includes(at.getHours())
    && parsed.dom.includes(at.getDate())
    && parsed.month.includes(at.getMonth() + 1)
    && parsed.dow.includes(at.getDay());
}

/** Compiles a glob pattern into a RegExp (double star spans directories). */
export function globToRegExp(glob: string): RegExp {
  const source = String(glob || '')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // `src/**/*.ts` must also match `src/a.ts`: a double star before a slash may be empty.
    .replace(/\*\*\//g, '\u0001')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0001/g, '(?:.*/)?')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${source}$`);
}

function normalizeTrigger(value: unknown): RuleTrigger {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_RULE_TRIGGER');
  const trigger = value as Record<string, unknown>;
  if (trigger.kind === 'cron') {
    const expression = typeof trigger.expression === 'string' ? trigger.expression.trim() : '';
    if (!expression || expression.length > 120) fail('INVALID_RULE_CRON');
    parseCron(expression); // throws on malformed input
    return { kind: 'cron', expression };
  }
  if (trigger.kind === 'event') {
    const event = typeof trigger.event === 'string' ? trigger.event.trim() : '';
    if (!EVENT_PATTERN.test(event)) fail('INVALID_RULE_EVENT');
    if (trigger.path === undefined || trigger.path === '') return { kind: 'event', event };
    const path = typeof trigger.path === 'string' ? trigger.path.trim().replace(/\\/g, '/') : '';
    if (!path || path.length > 200 || path.startsWith('/') || path.split('/').includes('..')) fail('INVALID_RULE_PATH');
    return { kind: 'event', event, path };
  }
  fail('INVALID_RULE_TRIGGER_KIND');
}

function normalizeCooldown(value: unknown): number {
  if (value === undefined) return DEFAULT_COOLDOWN_MS;
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0 || ms > 24 * 60 * 60 * 1000) fail('INVALID_RULE_COOLDOWN');
  return Math.floor(ms);
}

export function createRuleEngine(deps: RuleEngineDeps) {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => `rule_${Math.random().toString(36).slice(2, 10)}`);
  const rules = new Map<string, Rule>();
  const compiled = new Map<string, ReturnType<typeof parseCron>>();
  const persist = (rule: Rule) => { try { deps.store?.save(rule); } catch { /* the rule keeps working for this session */ } };
  for (const stored of deps.store?.load() ?? []) {
    try {
      const trigger = normalizeTrigger(stored.trigger);
      const rule: Rule = Object.freeze({ ...stored, trigger });
      rules.set(rule.id, rule);
      if (trigger.kind === 'cron') compiled.set(rule.id, parseCron(trigger.expression));
    } catch { /* one damaged rule must not stop the others from loading */ }
  }

  function assertOwned(id: string, ownerId: string): Rule {
    const rule = rules.get(id);
    if (!rule || rule.ownerId !== ownerId) fail('RULE_NOT_FOUND', 404);
    return rule;
  }

  function create(ownerId: string, input: RuleInput): Rule {
    const owner = typeof ownerId === 'string' ? ownerId.trim() : '';
    if (!owner) fail('RULE_OWNER_REQUIRED');
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (!NAME_PATTERN.test(name)) fail('INVALID_RULE_NAME');
    if ([...rules.values()].some((rule) => rule.ownerId === owner && rule.name === name)) fail('RULE_NAME_CONFLICT', 409);
    const task = typeof input?.task === 'string' ? input.task.trim() : '';
    if (!task || task.length > MAX_TASK_LENGTH) fail('INVALID_RULE_TASK');
    const agentId = typeof input?.agentId === 'string' ? input.agentId.trim() : '';
    if (!agentId || agentId.length > 120) fail('INVALID_RULE_AGENT');
    const trigger = normalizeTrigger(input?.trigger);
    const description = typeof input?.description === 'string' ? input.description.trim().slice(0, 300) : '';
    const cooldownMs = normalizeCooldown(input?.cooldownMs);
    const owned = [...rules.values()].filter((rule) => rule.ownerId === owner).length;
    if (owned >= MAX_RULES_PER_OWNER) fail('RULE_LIMIT_REACHED', 429);
    const rule: Rule = Object.freeze({
      id: newId(), ownerId: owner, name, description, trigger, task, agentId, cooldownMs,
      enabled: true, createdAt: now().toISOString(), lastFiredAt: null, fireCount: 0
    });
    rules.set(rule.id, rule);
    persist(rule);
    if (rule.trigger.kind === 'cron') compiled.set(rule.id, parseCron(rule.trigger.expression));
    return rule;
  }

  function list(ownerId: string): readonly Rule[] {
    const owner = typeof ownerId === 'string' ? ownerId.trim() : '';
    return Object.freeze([...rules.values()].filter((rule) => rule.ownerId === owner));
  }

  function remove(ownerId: string, id: string): Rule {
    const rule = assertOwned(String(id || '').trim(), ownerId);
    rules.delete(rule.id);
    compiled.delete(rule.id);
    try { deps.store?.remove(rule.id); } catch { /* removed for this session at least */ }
    return rule;
  }

  function setEnabled(ownerId: string, id: string, enabled: boolean): Rule {
    const rule = assertOwned(String(id || '').trim(), ownerId);
    const updated: Rule = Object.freeze({ ...rule, enabled: enabled === true });
    rules.set(updated.id, updated);
    persist(updated);
    return updated;
  }

  function cooling(rule: Rule, at: Date): boolean {
    if (!rule.lastFiredAt || rule.cooldownMs <= 0) return false;
    return at.getTime() - Date.parse(rule.lastFiredAt) < rule.cooldownMs;
  }

  async function fire(rule: Rule, reason: 'cron' | 'event', at: Date, payload?: Record<string, unknown>): Promise<{ readonly fired: boolean; readonly reason?: string }> {
    if (!rule.enabled) return { fired: false, reason: 'disabled' };
    if (cooling(rule, at)) return { fired: false, reason: 'cooldown' };
    const context: RuleRunContext = Object.freeze({ rule, reason, ...(payload ? { payload } : {}) });
    if (deps.guard) {
      let allowed = false;
      try { allowed = await deps.guard(context); } catch { allowed = false; }
      if (!allowed) return { fired: false, reason: 'guard' };
    }
    // Mark as fired before running so a slow task cannot be re-entered by a concurrent event.
    const fired: Rule = Object.freeze({ ...rule, lastFiredAt: at.toISOString(), fireCount: rule.fireCount + 1 });
    rules.set(rule.id, fired);
    persist(fired);
    try {
      await deps.run(context);
      return { fired: true };
    } catch (error) {
      return { fired: false, reason: String((error as { code?: string })?.code || (error as Error).message || 'RULE_RUN_FAILED').slice(0, 120) };
    }
  }

  /** Time sweep: call on a timer (e.g. every minute) to run cron rules that are due. */
  async function tick(at: Date = now()): Promise<readonly { readonly id: string; readonly fired: boolean; readonly reason?: string }[]> {
    const results: Array<{ id: string; fired: boolean; reason?: string }> = [];
    for (const rule of [...rules.values()]) {
      if (rule.trigger.kind !== 'cron') continue;
      const parsed = compiled.get(rule.id);
      if (!parsed || !cronMatches(parsed, at)) continue;
      results.push({ id: rule.id, ...(await fire(rule, 'cron', at)) });
    }
    return Object.freeze(results);
  }

  /** Event path: matches by event name; an optional `match` predicate narrows by payload. */
  async function emit(event: string, payload?: Record<string, unknown>, at: Date = now()): Promise<readonly { readonly id: string; readonly fired: boolean; readonly reason?: string }[]> {
    const name = typeof event === 'string' ? event.trim() : '';
    if (!name) return Object.freeze([]);
    const results: Array<{ id: string; fired: boolean; reason?: string }> = [];
    for (const rule of [...rules.values()]) {
      // Disabled rules are reported (not skipped) so callers can show why nothing ran.
      if (rule.trigger.kind !== 'event' || rule.trigger.event !== name) continue;
      if (rule.trigger.path && !globToRegExp(rule.trigger.path).test(String(payload?.path ?? ''))) continue;
      results.push({ id: rule.id, ...(await fire(rule, 'event', at, payload)) });
    }
    return Object.freeze(results);
  }

  return Object.freeze({ create, list, remove, setEnabled, tick, emit, parseCron, cronMatches, globToRegExp, size: () => rules.size });
}

export type RuleEngine = ReturnType<typeof createRuleEngine>;
