const SCHEDULE_LIST_SCOPES = Object.freeze({
  all: null,
  active: Object.freeze(new Set(['scheduled', 'running'])),
  history: Object.freeze(new Set(['completed', 'failed', 'cancelled'])),
  failed: Object.freeze(new Set(['failed']))
});

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

export {
  SCHEDULE_LIST_SCOPES,
  filterScheduleListOutput,
  matchesScheduleListScope,
  normalizeScheduleListScope
};
