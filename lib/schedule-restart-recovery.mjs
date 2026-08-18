const RESTART_ERROR = 'SCHEDULE_PROCESS_RESTARTED';

function cloneEntry(entry) {
  return { ...entry };
}

export function recoverInterruptedScheduleSnapshot(snapshot) {
  if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object' || !Array.isArray(snapshot.entries)) {
    throw new Error('INVALID_SCHEDULE_RESTART_SNAPSHOT');
  }

  let recovered = 0;
  const entries = snapshot.entries.map((entry) => {
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') {
      throw new Error('INVALID_SCHEDULE_RESTART_ENTRY');
    }
    if (entry.status !== 'running') return cloneEntry(entry);
    if (!Number.isInteger(entry.attempts) || entry.attempts < 1) {
      throw new Error('INVALID_SCHEDULE_RESTART_ATTEMPTS');
    }
    if (!Number.isInteger(entry.maxAttempts) || entry.maxAttempts < 1 || entry.attempts > entry.maxAttempts) {
      throw new Error('INVALID_SCHEDULE_RESTART_ATTEMPTS');
    }

    recovered += 1;
    return {
      ...entry,
      status: 'scheduled',
      attempts: entry.attempts - 1,
      lastError: RESTART_ERROR
    };
  });

  return Object.freeze({
    snapshot: { entries },
    recovered
  });
}

export { RESTART_ERROR };
