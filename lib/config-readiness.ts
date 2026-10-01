const BOOLEAN_VARS = Object.freeze(['HAFIZE_AUTH_REQUIRED', 'HAFIZE_COOKIE_SECURE', 'HAFIZE_TRUST_PROXY'] as const);
const SECRET_VARS = Object.freeze([
  'HAFIZE_AUTH_TOKEN',
  'NVIDIA_API_KEY',
  'GITHUB_TOKEN',
  'HAFIZE_CONNECTOR_AUTH_TOKEN',
  'HAFIZE_CONNECTOR_OWNER_KEY_B64',
  'HAFIZE_SCHEDULE_AUTH_TOKEN'
] as const);

export type ConfigEnv = Record<string, string | undefined>;
export type ConfigFindingCode = 'INVALID_ENV' | 'AUTH_SECRET_MISSING' | 'INSECURE_COOKIE_POLICY' | 'PROXY_TRUST_UNDOCUMENTED' | 'INVALID_BOOLEAN' | 'SECRET_CONTAINS_NEWLINE';
export interface ConfigFinding { readonly code: ConfigFindingCode; readonly field: string; }
export interface ConfigReadiness {
  readonly state: 'ready' | 'degraded' | 'blocked';
  readonly findings: readonly ConfigFinding[];
  readonly production: boolean;
  readonly publicRuntime: boolean;
  readonly authRequired: boolean;
  readonly secretVariables: readonly string[];
}

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const booleanValue = (value: unknown, fallback: boolean): boolean => {
  const raw = text(value);
  return raw ? /^(1|true|yes|on)$/i.test(raw) : fallback;
};
const problem = (code: ConfigFindingCode, field: string): Readonly<ConfigFinding> => Object.freeze({ code, field });

export function evaluateConfigReadiness(env: ConfigEnv = process.env): ConfigReadiness {
  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    return Object.freeze({ state: 'blocked', findings: Object.freeze([problem('INVALID_ENV', 'env')]), production: false, publicRuntime: false, authRequired: true, secretVariables: SECRET_VARS });
  }
  const host = text(env.HOST) || '127.0.0.1';
  const production = text(env.NODE_ENV).toLowerCase() === 'production';
  const publicRuntime = host !== '127.0.0.1';
  const authRequired = booleanValue(env.HAFIZE_AUTH_REQUIRED, production || publicRuntime);
  const findings: ConfigFinding[] = [];
  if (authRequired && text(env.HAFIZE_AUTH_TOKEN).length < 32) findings.push(problem('AUTH_SECRET_MISSING', 'HAFIZE_AUTH_TOKEN'));
  if (production && !booleanValue(env.HAFIZE_COOKIE_SECURE, true)) findings.push(problem('INSECURE_COOKIE_POLICY', 'HAFIZE_COOKIE_SECURE'));
  if (booleanValue(env.HAFIZE_TRUST_PROXY, false) && !text(env.HAFIZE_PROXY_TRUST_DESCRIPTION)) findings.push(problem('PROXY_TRUST_UNDOCUMENTED', 'HAFIZE_PROXY_TRUST_DESCRIPTION'));
  for (const name of BOOLEAN_VARS) {
    const raw = text(env[name]);
    if (raw && !/^(1|0|true|false|yes|no|on|off)$/i.test(raw)) findings.push(problem('INVALID_BOOLEAN', name));
  }
  for (const name of SECRET_VARS) {
    if (typeof env[name] === 'string' && /[\r\n]/.test(env[name] as string)) findings.push(problem('SECRET_CONTAINS_NEWLINE', name));
  }
  const state = findings.some((item) => item.code === 'AUTH_SECRET_MISSING') ? 'blocked' : findings.length ? 'degraded' : 'ready';
  return Object.freeze({ state, production, publicRuntime, authRequired, findings: Object.freeze(findings), secretVariables: SECRET_VARS });
}
export const CONFIG_READINESS_SECRET_VARIABLES = SECRET_VARS;
