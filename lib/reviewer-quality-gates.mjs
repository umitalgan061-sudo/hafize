import { containsPlaintextCredential } from './plaintext-credential-policy.mjs';

const MAX_FINDINGS = 100;
const SEVERITIES = new Set(['blocker', 'high', 'medium', 'low', 'info']);

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function finding(severity, code, message, location = '') {
  if (!SEVERITIES.has(severity)) throw new Error('INVALID_QUALITY_SEVERITY');
  return Object.freeze({ severity, code: clean(code, 80), message: clean(message, 1_000), location: clean(location, 300) });
}

// Detection lives in one place: the reviewer gate uses the same credential
// policy the runtime egress boundaries enforce.
function hasSecret(text) {
  return containsPlaintextCredential(text);
}

export function checkCredentialHygiene(files = []) {
  if (!Array.isArray(files)) throw new Error('INVALID_QUALITY_FILES');
  const findings = [];
  for (const file of files) {
    if (!file || typeof file !== 'object') continue;
    const path = clean(file.path, 300);
    const content = typeof file.content === 'string' ? file.content : '';
    if (/\.(env|pem|key|p12)$/i.test(path) && !/\.example$/i.test(path)) {
      findings.push(finding('blocker', 'CREDENTIAL_FILE', 'Credential-like file must not enter the repository.', path));
    }
    if (hasSecret(content)) findings.push(finding('blocker', 'SECRET_MATERIAL', 'Secret-like material detected in repository content.', path));
  }
  return Object.freeze(findings.slice(0, MAX_FINDINGS));
}

export function checkEvidenceContract(result = {}) {
  const findings = [];
  if (!result || typeof result !== 'object') throw new Error('INVALID_QUALITY_RESULT');
  const evidence = Array.isArray(result.evidence) ? result.evidence : [];
  const claims = Array.isArray(result.claims) ? result.claims : [];
  if (claims.length > 0 && evidence.length === 0) {
    findings.push(finding('high', 'MISSING_EVIDENCE', 'Claims are present without explicit evidence references.'));
  }
  const invalidEvidence = evidence.filter((item) => !item || typeof item !== 'object' || !clean(item.source, 300) || !clean(item.note, 500));
  if (invalidEvidence.length) findings.push(finding('medium', 'INVALID_EVIDENCE', 'Evidence entries require source and note.'));
  return Object.freeze(findings.slice(0, MAX_FINDINGS));
}

export function checkUiFinishContract(report = {}) {
  if (!report || typeof report !== 'object') throw new Error('INVALID_QUALITY_UI_REPORT');
  const checks = {
    responsive: report.responsive === true,
    keyboard: report.keyboard === true,
    focusVisible: report.focusVisible === true,
    contrast: report.contrast === true,
    emptyStates: report.emptyStates === true,
    loadingStates: report.loadingStates === true,
    errorStates: report.errorStates === true
  };
  const findings = Object.entries(checks)
    .filter(([, value]) => !value)
    .map(([name]) => finding('medium', `UI_${name.toUpperCase()}`, `UI finish gate failed: ${name}.`));
  return Object.freeze(findings);
}

export function evaluateQualityGates({ files = [], result = {}, ui = {} } = {}) {
  const findings = [
    ...checkCredentialHygiene(files),
    ...checkEvidenceContract(result),
    ...checkUiFinishContract(ui)
  ].slice(0, MAX_FINDINGS);
  const blockers = findings.filter((item) => item.severity === 'blocker' || item.severity === 'high');
  return Object.freeze({
    pass: blockers.length === 0,
    findings: Object.freeze(findings),
    blockerCount: blockers.length
  });
}

export const REVIEWER_QUALITY_GATE_SEVERITIES = Object.freeze([...SEVERITIES]);
