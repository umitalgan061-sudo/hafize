const MAX_ITEMS = 8;
const HANDOFF_FIELDS = new Set(['agentId', 'task', 'successCriteria', 'constraints', 'evidenceRequired']);

export interface TaskHandoff {
  readonly agentId: string;
  readonly task: string;
  readonly successCriteria: readonly string[];
  readonly constraints: readonly string[];
  readonly evidenceRequired: readonly string[];
}

export type TaskHandoffResult =
  | { readonly ok: true; readonly handoff: TaskHandoff }
  | { readonly ok: false; readonly error: string };

function cleanText(value: unknown, label: string, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) throw new Error(`INVALID_TASK_HANDOFF:${label}`);
  return text;
}

function cleanListItem(value: unknown, label: string): string {
  return cleanText(value, label, 500).replace(/\s+/g, ' ');
}

function cleanTextList(value: unknown, label: string): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_ITEMS) throw new Error(`INVALID_TASK_HANDOFF:${label}`);
  const items = value.map((item, index) => cleanListItem(item, `${label}.${index}`));
  if (new Set(items).size !== items.length) throw new Error(`INVALID_TASK_HANDOFF:${label}.duplicate`);
  return items;
}

export function normalizeTaskHandoff(input: unknown = {}): TaskHandoffResult {
  if (!input || Array.isArray(input) || typeof input !== 'object') return { ok: false, error: 'INVALID_TASK_HANDOFF:input' };
  for (const key of Object.keys(input)) if (!HANDOFF_FIELDS.has(key)) return { ok: false, error: 'INVALID_TASK_HANDOFF:field' };
  try {
    const value = input as Record<string, unknown>;
    const handoff: TaskHandoff = Object.freeze({
      agentId: cleanText(value.agentId, 'agentId', 120),
      task: cleanText(value.task, 'task', 20_000),
      successCriteria: Object.freeze(cleanTextList(value.successCriteria, 'successCriteria')),
      constraints: Object.freeze(cleanTextList(value.constraints, 'constraints')),
      evidenceRequired: Object.freeze(cleanTextList(value.evidenceRequired, 'evidenceRequired'))
    });
    return { ok: true, handoff };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'INVALID_TASK_HANDOFF' };
  }
}

export function formatTaskHandoff(handoff: unknown): { readonly ok: true; readonly task: string } | TaskHandoffResult {
  const normalized = normalizeTaskHandoff(handoff);
  if (!normalized.ok) return normalized;
  const value = normalized.handoff;
  const lines = [`Görev: ${value.task}`];
  if (value.successCriteria.length) lines.push('', 'Başarı ölçütleri:', ...value.successCriteria.map((item) => `- ${item}`));
  if (value.constraints.length) lines.push('', 'Kısıtlar:', ...value.constraints.map((item) => `- ${item}`));
  if (value.evidenceRequired.length) lines.push('', 'Beklenen kanıt:', ...value.evidenceRequired.map((item) => `- ${item}`));
  return { ok: true, task: lines.join('\n') };
}
