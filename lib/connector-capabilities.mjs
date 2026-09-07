const CAPABILITY_NAMES = Object.freeze([
  'github.read',
  'gmail.read',
  'canva.read',
  'calendar.read',
  'calendar.write',
  'reminder.read',
  'reminder.write'
]);

function normalizeCapability(value) {
  const capability = typeof value === 'string' ? value.trim() : '';
  return CAPABILITY_NAMES.includes(capability) ? capability : null;
}

export function createConnectorCapabilityMatrix({
  githubRead = false,
  gmailRead = false,
  canvaRead = false,
  calendarRead = false,
  calendarWrite = false,
  reminderRead = false,
  reminderWrite = false
} = {}) {
  const matrix = Object.freeze({
    'github.read': githubRead === true,
    'gmail.read': gmailRead === true,
    'canva.read': canvaRead === true,
    'calendar.read': calendarRead === true,
    'calendar.write': calendarWrite === true,
    'reminder.read': reminderRead === true,
    'reminder.write': reminderWrite === true
  });
  return Object.freeze({
    has(capability) {
      const name = normalizeCapability(capability);
      return name ? matrix[name] : false;
    },
    list() {
      return Object.freeze(Object.entries(matrix).filter(([, enabled]) => enabled).map(([name]) => name));
    },
    canWrite() {
      return matrix['calendar.write'] || matrix['reminder.write'];
    },
    matrix
  });
}

export function enforceCapabilityImplication(matrix) {
  if (!matrix || typeof matrix !== 'object') throw new Error('INVALID_CONNECTOR_CAPABILITY_MATRIX');
  const issues = [];
  if (matrix['calendar.write'] === true && matrix['calendar.read'] !== true) issues.push('CALENDAR_WRITE_REQUIRES_READ');
  if (matrix['reminder.write'] === true && matrix['reminder.read'] !== true) issues.push('REMINDER_WRITE_REQUIRES_READ');
  return Object.freeze({ pass: issues.length === 0, issues: Object.freeze(issues) });
}

export const CONNECTOR_CAPABILITY_NAMES = CAPABILITY_NAMES;
