import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const STAGES = new Set(['resolved', 'denied', 'started', 'completed', 'error', 'consent_policy_set', 'consent_revoked']);
const DEFAULT_MAX_EVENTS = 1_000;

function safeIdentity(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > 160 || /[\0\r\n]/.test(text)) throw new Error(`INVALID_SKILL_AUDIT:${field}`);
  return text;
}

function canonical(value: unknown, depth = 0): string {
  if (depth > 12) throw new Error('SKILL_AUDIT_VALUE_TOO_DEEP');
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map((item) => canonical(item, depth + 1)).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).sort().map((key) => JSON.stringify(key) + ':' + canonical(object[key], depth + 1)).join(',') + '}';
}

export function hashSkillAuditValue(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export function createFileSkillAuditSink({ filePath = resolve('data/skill-audit.jsonl'), maxBytes = 20 * 1024 * 1024 } = {}) {
  if (typeof filePath !== 'string' || !filePath.trim() || !Number.isSafeInteger(maxBytes) || maxBytes < 1024) throw new Error('INVALID_SKILL_AUDIT:fileSink');
  const target = resolve(filePath);
  return (event: Readonly<Record<string, unknown>>) => {
    const line = JSON.stringify(event) + '\n';
    mkdirSync(dirname(target), { recursive: true });
    let currentSize = 0;
    try { currentSize = statSync(target).size; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (currentSize + Buffer.byteLength(line, 'utf8') > maxBytes) throw new Error('SKILL_AUDIT_STORE_CAPACITY_REACHED');
    appendFileSync(target, line, { encoding: 'utf8', flag: 'a' });
  };
}

export function createSkillAuditLog({ maxEvents = DEFAULT_MAX_EVENTS, now = () => new Date(), sink }: {
  maxEvents?: number;
  now?: () => Date;
  sink?: (event: Readonly<Record<string, unknown>>) => unknown;
} = {}) {
  if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 100_000) throw new Error('INVALID_SKILL_AUDIT:maxEvents');
  if (typeof now !== 'function') throw new Error('INVALID_SKILL_AUDIT:now');
  if (sink !== undefined && typeof sink !== 'function') throw new Error('INVALID_SKILL_AUDIT:sink');
  const events: Readonly<Record<string, unknown>>[] = [];

  function record(input: Record<string, unknown>) {
    const stage = typeof input.stage === 'string' ? input.stage : '';
    if (!STAGES.has(stage)) throw new Error('INVALID_SKILL_AUDIT:stage');
    const instant = now();
    if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) throw new Error('INVALID_SKILL_AUDIT:now');
    const event = Object.freeze({
      type: 'skill.audit',
      stage,
      traceId: safeIdentity(input.traceId, 'traceId'),
      agentId: safeIdentity(input.agentId, 'agentId'),
      skillId: safeIdentity(input.skillId, 'skillId'),
      argsHash: hashSkillAuditValue(input.arguments ?? {}),
      ...(input.result === undefined ? {} : { resultHash: hashSkillAuditValue(input.result) }),
      ...(typeof input.consentId === 'string' && input.consentId ? { consentId: safeIdentity(input.consentId, 'consentId') } : {}),
      timestamp: instant.toISOString()
    });
    if (sink) {
      try {
        const result = sink(event);
        if (result && typeof (result as { then?: unknown }).then === 'function') throw new Error('SKILL_AUDIT_SINK_MUST_BE_SYNCHRONOUS');
      } catch {
        throw new Error('SKILL_AUDIT_SINK_FAILED');
      }
    }
    events.push(event);
    if (events.length > maxEvents) events.splice(0, events.length - maxEvents);
    return event;
  }

  return Object.freeze({ record, snapshot: () => Object.freeze([...events]), get size() { return events.length; } });
}

export const SKILL_AUDIT_DEFAULTS = Object.freeze({ maxEvents: DEFAULT_MAX_EVENTS, maxFileBytes: 20 * 1024 * 1024, hash: 'sha256', storesRawArguments: false });
