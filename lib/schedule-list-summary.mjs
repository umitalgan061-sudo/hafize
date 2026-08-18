const SUMMARY_VIEW = 'summary';
const MAX_SUMMARY_TASK_CHARS = 180;
const MAX_SUMMARY_TASK_BYTES = 720;
const MAX_SUMMARY_AGENT_ID_CHARS = 120;
const MAX_SUMMARY_SCHEDULE_ID_CHARS = 120;
const MAX_SUMMARY_ISO_CHARS = 64;
const SUMMARY_STATUSES = new Set(['scheduled', 'running', 'completed', 'failed', 'cancelled']);
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function safeBoundedText(value, maxChars) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (!clean || clean.length > maxChars || CONTROL_CHAR_PATTERN.test(clean)) return null;
  return clean;
}

function truncateUtf8(value, maxChars = MAX_SUMMARY_TASK_CHARS, maxBytes = MAX_SUMMARY_TASK_BYTES) {
  if (typeof value !== 'string') return null;
  const clean = value.replace(CONTROL_CHARS, ' ').trim().replace(/\s+/g, ' ');
  if (!clean) return null;

  const codePoints = Array.from(clean);
  let text = codePoints.length > maxChars ? codePoints.slice(0, maxChars).join('') : clean;
  let truncated = codePoints.length > maxChars;
  while (Buffer.byteLength(text, 'utf8') > maxBytes && text) {
    text = Array.from(text).slice(0, -1).join('');
    truncated = true;
  }
  text = text.trimEnd();
  if (!text) return null;
  if (!truncated) return { text, truncated: false };

  const ellipsis = '…';
  while (text && Buffer.byteLength(`${text}${ellipsis}`, 'utf8') > maxBytes) {
    text = Array.from(text).slice(0, -1).join('').trimEnd();
  }
  if (!text) return null;
  if (Array.from(text).length >= maxChars) text = Array.from(text).slice(0, maxChars - 1).join('').trimEnd();
  return { text: `${text}${ellipsis}`, truncated: true };
}

function normalizeSummaryIso(value) {
  const text = safeBoundedText(value, MAX_SUMMARY_ISO_CHARS);
  if (!text) return null;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function summarizeSchedule(schedule) {
  if (!schedule || Array.isArray(schedule) || typeof schedule !== 'object') return null;
  const scheduleId = safeBoundedText(schedule.scheduleId, MAX_SUMMARY_SCHEDULE_ID_CHARS);
  const agentId = safeBoundedText(schedule.agentId, MAX_SUMMARY_AGENT_ID_CHARS);
  const task = truncateUtf8(schedule.task);
  const runAt = normalizeSummaryIso(schedule.runAt);
  const status = typeof schedule.status === 'string' && SUMMARY_STATUSES.has(schedule.status) ? schedule.status : null;
  const attempts = Number.isSafeInteger(schedule.attempts) && schedule.attempts >= 0 && schedule.attempts <= 5
    ? schedule.attempts
    : null;
  const maxAttempts = Number.isSafeInteger(schedule.maxAttempts) && schedule.maxAttempts >= 1 && schedule.maxAttempts <= 5
    ? schedule.maxAttempts
    : null;
  if (!scheduleId || !agentId || !task || !runAt || !status || attempts === null || maxAttempts === null || attempts > maxAttempts) {
    return null;
  }
  return Object.freeze({
    scheduleId,
    agentId,
    task: task.text,
    taskTruncated: task.truncated,
    runAt,
    status,
    attempts,
    maxAttempts
  });
}

function summarizeScheduleListOutput(output) {
  if (!output?.ok || !Array.isArray(output.schedules)) return output;
  const schedules = [];
  for (const schedule of output.schedules) {
    const summary = summarizeSchedule(schedule);
    if (summary) schedules.push(summary);
  }
  const listMeta = output.listMeta && typeof output.listMeta === 'object' && !Array.isArray(output.listMeta)
    ? { ...output.listMeta, returned: schedules.length }
    : output.listMeta;
  return {
    ok: true,
    schedules,
    ...(listMeta ? { listMeta } : {}),
    view: SUMMARY_VIEW
  };
}

function normalizeScheduleListView(value = null) {
  if (value == null || value === '') return null;
  if (value !== SUMMARY_VIEW) fail('INVALID_SCHEDULE_LIST_VIEW');
  return SUMMARY_VIEW;
}

export {
  MAX_SUMMARY_AGENT_ID_CHARS,
  MAX_SUMMARY_ISO_CHARS,
  MAX_SUMMARY_SCHEDULE_ID_CHARS,
  MAX_SUMMARY_TASK_BYTES,
  MAX_SUMMARY_TASK_CHARS,
  SUMMARY_STATUSES,
  SUMMARY_VIEW,
  normalizeScheduleListView,
  normalizeSummaryIso,
  safeBoundedText,
  summarizeSchedule,
  summarizeScheduleListOutput,
  truncateUtf8
};
