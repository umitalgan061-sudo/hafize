const DEFAULT_SCHEDULE_LIST_LIMIT = 200;
const MAX_SCHEDULE_LIST_LIMIT = 500;
const ACTIVE_STATUSES = new Set(['scheduled', 'running']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeScheduleListLimit(value = DEFAULT_SCHEDULE_LIST_LIMIT) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_SCHEDULE_LIST_LIMIT) {
    fail('INVALID_SCHEDULE_LIST_LIMIT');
  }
  return value;
}

function timestampOf(entry) {
  for (const value of [entry?.updatedAt, entry?.createdAt, entry?.runAt]) {
    if (typeof value !== 'string') continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function scheduleIdOrder(entry) {
  const match = /^schedule_([1-9][0-9]*)$/.exec(String(entry?.scheduleId || ''));
  const value = match ? Number(match[1]) : Number.NaN;
  return Number.isSafeInteger(value) ? value : 0;
}

function newestFirst(left, right) {
  return timestampOf(right) - timestampOf(left) || scheduleIdOrder(right) - scheduleIdOrder(left);
}

export function boundScheduleListOutput(output, { limit = DEFAULT_SCHEDULE_LIST_LIMIT } = {}) {
  const listLimit = normalizeScheduleListLimit(limit);
  if (!output?.ok || !Array.isArray(output.schedules)) return output;
  if (output.schedules.length <= listLimit) return output;

  const active = [];
  const terminal = [];
  for (const schedule of output.schedules) {
    if (ACTIVE_STATUSES.has(schedule?.status)) active.push(schedule);
    else terminal.push(schedule);
  }

  active.sort(newestFirst);
  terminal.sort(newestFirst);
  const selected = active.length >= listLimit
    ? active.slice(0, listLimit)
    : active.concat(terminal.slice(0, listLimit - active.length));

  return {
    ...output,
    schedules: selected,
    listMeta: {
      returned: selected.length,
      total: output.schedules.length,
      truncated: true
    }
  };
}

export {
  ACTIVE_STATUSES as SCHEDULE_LIST_ACTIVE_STATUSES,
  DEFAULT_SCHEDULE_LIST_LIMIT,
  MAX_SCHEDULE_LIST_LIMIT,
  newestFirst,
  normalizeScheduleListLimit,
  scheduleIdOrder,
  timestampOf
};
