const MAX_ITEMS = 8;
const HANDOFF_FIELDS = new Set([
  'agentId',
  'task',
  'successCriteria',
  'constraints',
  'evidenceRequired'
]);

function cleanText(value, label, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) throw new Error(`INVALID_TASK_HANDOFF:${label}`);
  return text;
}

function cleanListItem(value, label) {
  return cleanText(value, label, 500).replace(/\s+/g, ' ');
}

function cleanTextList(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_ITEMS) {
    throw new Error(`INVALID_TASK_HANDOFF:${label}`);
  }
  const items = value.map((item, index) => cleanListItem(item, `${label}.${index}`));
  if (new Set(items).size !== items.length) throw new Error(`INVALID_TASK_HANDOFF:${label}.duplicate`);
  return items;
}

export function normalizeTaskHandoff(input = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') {
    return { ok: false, error: 'INVALID_TASK_HANDOFF:input' };
  }
  for (const key of Object.keys(input)) {
    if (!HANDOFF_FIELDS.has(key)) return { ok: false, error: 'INVALID_TASK_HANDOFF:field' };
  }

  try {
    const handoff = {
      agentId: cleanText(input.agentId, 'agentId', 120),
      task: cleanText(input.task, 'task', 20000),
      successCriteria: cleanTextList(input.successCriteria, 'successCriteria'),
      constraints: cleanTextList(input.constraints, 'constraints'),
      evidenceRequired: cleanTextList(input.evidenceRequired, 'evidenceRequired')
    };
    return { ok: true, handoff };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function formatTaskHandoff(handoff) {
  const normalized = normalizeTaskHandoff(handoff);
  if (!normalized.ok) return normalized;
  const value = normalized.handoff;
  const lines = [`Görev: ${value.task}`];
  if (value.successCriteria.length) {
    lines.push('', 'Başarı ölçütleri:', ...value.successCriteria.map((item) => `- ${item}`));
  }
  if (value.constraints.length) {
    lines.push('', 'Kısıtlar:', ...value.constraints.map((item) => `- ${item}`));
  }
  if (value.evidenceRequired.length) {
    lines.push('', 'Beklenen kanıt:', ...value.evidenceRequired.map((item) => `- ${item}`));
  }
  return { ok: true, task: lines.join('\n') };
}
