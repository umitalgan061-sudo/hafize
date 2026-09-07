const REQUIRED_GATES = Object.freeze(['auth', 'pwa', 'skills', 'memory', 'schedule', 'connectors', 'model']);

function text(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function createReleaseManifest({ version, commit, readiness, checks = [] } = {}) {
  const safeVersion = text(version, 80);
  const safeCommit = text(commit, 120);
  if (!safeVersion) throw new Error('INVALID_RELEASE_VERSION');
  if (!safeCommit) throw new Error('INVALID_RELEASE_COMMIT');
  if (!readiness || typeof readiness !== 'object' || readiness.ready !== true) throw new Error('RELEASE_READINESS_BLOCKED');

  const normalizedChecks = Array.isArray(checks)
    ? checks.filter((check) => check && typeof check === 'object').map((check) => Object.freeze({
      name: text(check.name, 120),
      pass: check.pass === true
    }))
    : [];
  const requiredCheckCount = normalizedChecks.filter((check) => check.name).length;
  const failed = normalizedChecks.filter((check) => !check.name || !check.pass);

  return Object.freeze({
    version: safeVersion,
    commit: safeCommit,
    generatedAt: new Date().toISOString(),
    requiredGates: REQUIRED_GATES,
    readiness: Object.freeze({ blocked: [...(readiness.blocked || [])], warnings: [...(readiness.warnings || [])] }),
    checks: Object.freeze(normalizedChecks),
    releaseable: requiredCheckCount > 0 && failed.length === 0 && readiness.ready === true
  });
}

export function missingReleaseGates(readiness) {
  if (!readiness || typeof readiness !== 'object') return Object.freeze([...REQUIRED_GATES]);
  return Object.freeze(REQUIRED_GATES.filter((gate) => readiness.components?.[gate]?.status !== 'ready'));
}

export const RELEASE_MANIFEST_GATES = REQUIRED_GATES;
