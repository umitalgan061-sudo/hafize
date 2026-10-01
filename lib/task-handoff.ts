const MAX_ITEMS = 8;
const MAX_AGENT_ID = 120;
const MAX_TASK = 20_000;
const MAX_ITEM = 500;

export interface TaskHandoff {
  readonly agentId: string;
  readonly task: string;
  readonly successCriteria: readonly string[];
  readonly constraints: readonly string[];
  readonly evidenceRequired: readonly string[];
}
export type TaskHandoffResult =
  | Readonly<{ ok: true; handoff: TaskHandoff }>
  | Readonly<{ ok: false; error: string }>;
export type TaskHandoffFormatted =
  | Readonly<{ ok: true; task: string }>
  | Readonly<{ ok: false; error: string }>;

function cleanText(value: unknown, label: string, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || text.includes('\0')) throw new Error(`INVALID_TASK_HANDOFF:${label}`);
  return text;
}
function cleanListItem(value: unknown, label: string): string {
  return cleanText(value, label, MAX_ITEM).replace(/\s+/g, ' ');
}
function cleanTextList(value: unknown, label: string): readonly string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_ITEMS) throw new Error(`INVALID_TASK_HANDOFF:${label}`);
  const items = value.map((item, index) => cleanListItem(item, `${label}.${index}`));
  if (new Set(items).size !== items.length) throw new Error(`INVALID_TASK_HANDOFF:${label}.duplicate`);
  return Object.freeze(items);
}
function ownKeys(value: Record<string, unknown>): boolean {
  const fields = new Set(['agentId', 'task', 'successCriteria', 'constraints', 'evidenceRequired']);
  return Object.keys(value).every((key) => fields.has(key));
}
export function normalizeTaskHandoff(input: unknown = {}): TaskHandoffResult {
  if (!input || Array.isArray(input) || typeof input !== 'object') return { ok: false, error: 'INVALID_TASK_HANDOFF:input' };
  const value = input as Record<string, unknown>;
  if (!ownKeys(value)) return { ok: false, error: 'INVALID_TASK_HANDOFF:field' };
  try {
    const handoff: TaskHandoff = Object.freeze({
      agentId: cleanText(value.agentId, 'agentId', MAX_AGENT_ID),
      task: cleanText(value.task, 'task', MAX_TASK),
      successCriteria: cleanTextList(value.successCriteria, 'successCriteria'),
      constraints: cleanTextList(value.constraints, 'constraints'),
      evidenceRequired: cleanTextList(value.evidenceRequired, 'evidenceRequired')
    });
    return { ok: true, handoff };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'INVALID_TASK_HANDOFF' };
  }
}
export function formatTaskHandoff(handoff: unknown): TaskHandoffFormatted {
  const normalized = normalizeTaskHandoff(handoff);
  if (!normalized.ok) return normalized;
  const value = normalized.handoff;
  const lines = [`Görev: ${value.task}`];
  if (value.successCriteria.length) lines.push('', 'Başarı ölçütleri:', ...value.successCriteria.map((item) => `- ${item}`));
  if (value.constraints.length) lines.push('', 'Kısıtlar:', ...value.constraints.map((item) => `- ${item}`));
  if (value.evidenceRequired.length) lines.push('', 'Beklenen kanıt:', ...value.evidenceRequired.map((item) => `- ${item}`));
  return Object.freeze({ ok: true, task: lines.join('\n') });
}
export const TASK_HANDOFF_LIMITS = Object.freeze({
  maxItems: MAX_ITEMS, maxAgentId: MAX_AGENT_ID, maxTask: MAX_TASK, maxListItem: MAX_ITEM
});
