export type ConnectorCapability =
  | 'github.read'
  | 'gmail.read'
  | 'canva.read'
  | 'calendar.read'
  | 'calendar.write'
  | 'reminder.read'
  | 'reminder.write';

export interface ConnectorCapabilityOptions {
  githubRead?: boolean;
  gmailRead?: boolean;
  canvaRead?: boolean;
  calendarRead?: boolean;
  calendarWrite?: boolean;
  reminderRead?: boolean;
  reminderWrite?: boolean;
}
export interface ConnectorCapabilityMatrix {
  'github.read': boolean;
  'gmail.read': boolean;
  'canva.read': boolean;
  'calendar.read': boolean;
  'calendar.write': boolean;
  'reminder.read': boolean;
  'reminder.write': boolean;
}

const CAPABILITY_NAMES = Object.freeze([
  'github.read',
  'gmail.read',
  'canva.read',
  'calendar.read',
  'calendar.write',
  'reminder.read',
  'reminder.write'
] as const);

function normalizeCapability(value: unknown): ConnectorCapability | null {
  const capability = typeof value === 'string' ? value.trim() : '';
  return (CAPABILITY_NAMES as readonly string[]).includes(capability) ? capability as ConnectorCapability : null;
}

export function createConnectorCapabilityMatrix(options: ConnectorCapabilityOptions = {}) {
  const matrix: ConnectorCapabilityMatrix = Object.freeze({
    'github.read': options.githubRead === true,
    'gmail.read': options.gmailRead === true,
    'canva.read': options.canvaRead === true,
    'calendar.read': options.calendarRead === true,
    'calendar.write': options.calendarWrite === true,
    'reminder.read': options.reminderRead === true,
    'reminder.write': options.reminderWrite === true
  });
  return Object.freeze({
    has(capability: unknown): boolean {
      const name = normalizeCapability(capability);
      return name ? matrix[name] : false;
    },
    list(): ReadonlyArray<ConnectorCapability> {
      return Object.freeze((Object.entries(matrix) as Array<[ConnectorCapability, boolean]>).filter(([, enabled]) => enabled).map(([name]) => name));
    },
    canWrite(): boolean {
      return matrix['calendar.write'] || matrix['reminder.write'];
    },
    matrix
  });
}

export function enforceCapabilityImplication(matrix: Partial<ConnectorCapabilityMatrix> | unknown) {
  if (!matrix || typeof matrix !== 'object') throw new Error('INVALID_CONNECTOR_CAPABILITY_MATRIX');
  const value = matrix as Partial<ConnectorCapabilityMatrix>;
  const issues: string[] = [];
  if (value['calendar.write'] === true && value['calendar.read'] !== true) issues.push('CALENDAR_WRITE_REQUIRES_READ');
  if (value['reminder.write'] === true && value['reminder.read'] !== true) issues.push('REMINDER_WRITE_REQUIRES_READ');
  return Object.freeze({ pass: issues.length === 0, issues: Object.freeze(issues) });
}

export const CONNECTOR_CAPABILITY_NAMES = CAPABILITY_NAMES;
