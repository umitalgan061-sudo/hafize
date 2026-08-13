const MAX_ITEMS = 8;

function cleanText(value, label, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) throw new Error(`INVALID_TASK_HANDOFF:${label}`);
  return text;
}

function cleanTextList(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_ITEMS) {
    throw new Error(`INVALID_TASK_HANDOFF:${label}`);
  }
  const items = value.map((item, index) => cleanText(item, `${label}.${index}`, 500));
  if (new Set(items).size !== items.length) throw new Error(`INVALID_TASK_HANDOFF:${label}.duplicate`);
  return items;
}

export function normalizeTaskHandoff(input = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') {
    return { ok: false, error: 'INVALID_TASK_HANDOFF:input' };
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
