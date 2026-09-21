(function exposeHafizeComposerSecretScanner(root) {
  'use strict';
  const MAX_SCAN_CHARS = 80_000;
  const MAX_MATCHES = 12;
  const RULES = Object.freeze([
    { id: 'private-key', label: 'Private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i },
    { id: 'github-token', label: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
    { id: 'openai-key', label: 'OpenAI-style key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
    { id: 'aws-access-key', label: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
    { id: 'google-key', label: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/ },
    { id: 'slack-token', label: 'Slack token', pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/ },
    { id: 'jwt', label: 'JWT', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
    { id: 'connection-secret', label: 'Credential assignment', pattern: /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|private[_-]?key)\s*[:=]\s*['\"][^'\"\s]{12,}/i }
  ]);
  function scan(value) {
    const text = String(value ?? '').replace(/\0/g, '').slice(0, MAX_SCAN_CHARS);
    const findings = [];
    for (const rule of RULES) if (rule.pattern.test(text)) { findings.push({ id: rule.id, label: rule.label }); if (findings.length >= MAX_MATCHES) break; }
    return Object.freeze({ risky: findings.length > 0, findings, scannedChars: text.length });
  }
  function summary(result) {
    if (!result?.risky) return 'Bilinen secret deseni bulunmadı.';
    return `${result.findings.length} olası hassas desen bulundu: ${result.findings.map((item) => item.label).join(', ')}.`.slice(0, 240);
  }
  root.HafizeComposerSecretScanner = Object.freeze({ MAX_SCAN_CHARS, MAX_MATCHES, RULE_IDS: Object.freeze(RULES.map((rule) => rule.id)), scan, summary });
})(typeof globalThis !== 'undefined' ? globalThis : self);