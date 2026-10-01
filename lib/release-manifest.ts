const REQUIRED_GATES = Object.freeze(['auth', 'pwa', 'skills', 'memory', 'schedule', 'connectors', 'model'] as const);
export interface ReleaseCheck { readonly name: string; readonly pass: boolean; }
export interface ReleaseReadiness { readonly ready: boolean; readonly blocked?: readonly string[]; readonly warnings?: readonly string[]; readonly components?: Readonly<Record<string, { status: string }>>; }
export interface ReleaseManifest {
  readonly version: string;
  readonly commit: string;
  readonly generatedAt: string;
  readonly requiredGates: readonly string[];
  readonly readiness: { readonly blocked: readonly string[]; readonly warnings: readonly string[] };
  readonly checks: readonly ReleaseCheck[];
  readonly releaseable: boolean;
}
const text = (value: unknown, max = 500): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function createReleaseManifest(input: { version?: unknown; commit?: unknown; readiness?: ReleaseReadiness; checks?: readonly unknown[] } = {}): ReleaseManifest {
  const version = text(input.version, 80);
  const commit = text(input.commit, 120);
  if (!version) throw new Error('INVALID_RELEASE_VERSION');
  if (!commit) throw new Error('INVALID_RELEASE_COMMIT');
  if (!input.readiness || input.readiness.ready !== true) throw new Error('RELEASE_READINESS_BLOCKED');
  const checks: ReleaseCheck[] = Array.isArray(input.checks)
    ? input.checks.filter((check): check is Record<string, unknown> => Boolean(check && typeof check === 'object')).map((check) => Object.freeze({ name: text(check.name, 120), pass: check.pass === true }))
    : [];
  const requiredCheckCount = checks.filter((check) => check.name).length;
  const failed = checks.filter((check) => !check.name || !check.pass);
  return Object.freeze({
    version,
    commit,
    generatedAt: new Date().toISOString(),
    requiredGates: REQUIRED_GATES,
    readiness: Object.freeze({ blocked: [...(input.readiness.blocked || [])], warnings: [...(input.readiness.warnings || [])] }),
    checks: Object.freeze(checks),
    releaseable: requiredCheckCount > 0 && failed.length === 0 && input.readiness.ready === true
  });
}
export function missingReleaseGates(readiness: ReleaseReadiness | null | undefined): readonly string[] {
  if (!readiness || typeof readiness !== 'object') return Object.freeze([...REQUIRED_GATES]);
  return Object.freeze(REQUIRED_GATES.filter((gate) => readiness.components?.[gate]?.status !== 'ready'));
}
export const RELEASE_MANIFEST_GATES = REQUIRED_GATES;
