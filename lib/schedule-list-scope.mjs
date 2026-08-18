const SCHEDULE_LIST_SCOPES = Object.freeze({
  all: null,
  active: Object.freeze(new Set(['scheduled', 'running'])),
  history: Object.freeze(new Set(['completed', 'failed', 'cancelled'])),
  failed: Object.freeze(new Set(['failed']))
});
const SCHEDULE_LIST_COUNT_KEYS = Object.freeze(Object.keys(SCHEDULE_LIST_SCOPES));
const MAX_SCHEDULE_SCOPE_COUNT = 1_000_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeScheduleListScope(value = null) {
  if (value == null) return 'all';
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(SCHEDULE_LIST_SCOPES, value)) {
    fail('INVALID_SCHEDULE_LIST_SCOPE');
  }
  return value;
}

function matchesScheduleListScope(schedule, scope = 'all') {
  const normalized = normalizeScheduleListScope(scope);
  const statuses = SCHEDULE_LIST_SCOPES[normalized];
  if (statuses === null) return true;
  return statuses.has(schedule?.status);
}

function filterScheduleListOutput(output, scope = 'all') {
  const normalized = normalizeScheduleListScope(scope);
  if (!output?.ok || !Array.isArray(output.schedules)) return output;
  if (normalized === 'all') return output;
  return {
    ...output,
    schedules: output.schedules.filter((schedule) => matchesScheduleListScope(schedule, normalized))
  };
}

function createScheduleListScopeCounts(output) {
  if (!output?.ok || !Array.isArray(output.schedules)) return null;
  const counts = { all: 0, active: 0, history: 0, failed: 0 };
  for (const schedule of output.schedules) {
    counts.all += 1;
    if (matchesScheduleListScope(schedule, 'active')) counts.active += 1;
    if (matchesScheduleListScope(schedule, 'history')) counts.history += 1;
    if (matchesScheduleListScope(schedule, 'failed')) counts.failed += 1;
    if (counts.all > MAX_SCHEDULE_SCOPE_COUNT) fail('SCHEDULE_LIST_SCOPE_COUNT_TOO_LARGE');
  }
  return Object.freeze(counts);
}

function normalizeScheduleListScopeCounts(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const normalized = {};
  for (const key of SCHEDULE_LIST_COUNT_KEYS) {
    const count = value[key];
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_SCHEDULE_SCOPE_COUNT) return null;
    normalized[key] = count;
  }
  if (normalized.active > normalized.all || normalized.history > normalized.all || normalized.failed > normalized.history) return null;
  if (normalized.active + normalized.history !== normalized.all) return null;
  return Object.freeze(normalized);
}

function attachScheduleListScopeCounts(output, counts) {
  if (!output?.ok) return output;
  const normalized = normalizeScheduleListScopeCounts(counts);
  if (!normalized) fail('INVALID_SCHEDULE_LIST_SCOPE_COUNTS');
  const existingMeta = output.listMeta && !Array.isArray(output.listMeta) && typeof output.listMeta === 'object'
    ? output.listMeta
    : {};
  return {
    ...output,
    listMeta: {
      ...existingMeta,
      scopeCounts: normalized
    }
  };
}

export {
  MAX_SCHEDULE_SCOPE_COUNT,
  SCHEDULE_LIST_COUNT_KEYS,
  SCHEDULE_LIST_SCOPES,
  attachScheduleListScopeCounts,
  createScheduleListScopeCounts,
  filterScheduleListOutput,
  matchesScheduleListScope,
  normalizeScheduleListScope,
  normalizeScheduleListScopeCounts
};
