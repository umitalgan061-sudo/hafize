const BOOLEAN_VARS = Object.freeze(['HAFIZE_AUTH_REQUIRED','HAFIZE_COOKIE_SECURE','HAFIZE_TRUST_PROXY']);
const SECRET_VARS = Object.freeze(['HAFIZE_AUTH_TOKEN','NVIDIA_API_KEY','GITHUB_TOKEN','HAFIZE_CONNECTOR_AUTH_TOKEN','HAFIZE_CONNECTOR_OWNER_KEY_B64','HAFIZE_SCHEDULE_AUTH_TOKEN']);

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function booleanValue(value, fallback) {
  const raw = text(value);
  if (!raw) return fallback;
  return /^(1|true|yes|on)$/i.test(raw);
}
function problem(code, field) { return Object.freeze({ code, field }); }

export function evaluateConfigReadiness(env = process.env) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) return Object.freeze({ state: 'blocked', findings: [problem('INVALID_ENV','env')] });
  const production = text(env.NODE_ENV).toLowerCase() === 'production' || text(env.HOST) === '0.0.0.0';
  const findings = [];
  if (production && text(env.HAFIZE_AUTH_TOKEN).length < 32) findings.push(problem('AUTH_SECRET_MISSING','HAFIZE_AUTH_TOKEN'));
  if (production && !booleanValue(env.HAFIZE_COOKIE_SECURE, true)) findings.push(problem('INSECURE_COOKIE_POLICY','HAFIZE_COOKIE_SECURE'));
  if (booleanValue(env.HAFIZE_TRUST_PROXY, false) && !text(env.HAFIZE_PROXY_TRUST_DESCRIPTION)) findings.push(problem('PROXY_TRUST_UNDOCUMENTED','HAFIZE_PROXY_TRUST_DESCRIPTION'));
  for (const name of BOOLEAN_VARS) if (text(env[name]) && !/^(1|0|true|false|yes|no|on|off)$/i.test(text(env[name]))) findings.push(problem('INVALID_BOOLEAN', name));
  for (const name of SECRET_VARS) if (text(env[name]) && /[\r\n]/.test(text(env[name]))) findings.push(problem('SECRET_CONTAINS_NEWLINE', name));
  const state = findings.some((item) => item.code === 'AUTH_SECRET_MISSING') ? 'blocked' : findings.length ? 'degraded' : 'ready';
  return Object.freeze({ state, production, findings: Object.freeze(findings), secretVariables: SECRET_VARS });
}

export const CONFIG_READINESS_SECRET_VARIABLES = SECRET_VARS;
