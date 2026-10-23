// TypeScript migration wave 2026-10.
// Sandboxed executor stub for skills with riskLevel >= medium.
// Implements WebAssembly / Deno isolate style limits.
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MEMORY_MB = 128;
const DEFAULT_CPU_SHARES = 256;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function createSandboxExecutor({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  memoryMb = DEFAULT_MEMORY_MB,
  cpuShares = DEFAULT_CPU_SHARES,
  allowedNetwork = false,
  allowedWrite = false
} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100) fail('INVALID_SANDBOX_TIMEOUT');
  if (!Number.isSafeInteger(memoryMb) || memoryMb < 16) fail('INVALID_SANDBOX_MEMORY');
  if (!Number.isSafeInteger(cpuShares) || cpuShares < 1) fail('INVALID_SANDBOX_CPU');

  const config = Object.freeze({
    timeoutMs,
    memoryMb,
    cpuShares,
    allowedNetwork,
    allowedWrite
  });

  async function execute({ skillId, args, handler, signal } = {}) {
    if (typeof skillId !== 'string' || !skillId) fail('INVALID_SANDBOX_SKILL_ID');
    if (typeof handler !== 'function') fail('INVALID_SANDBOX_HANDLER');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const result = await Promise.race([
        handler({ skillId, args, config, signal: controller.signal }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SANDBOX_TIMEOUT')), timeoutMs))
      ]);
      return { ok: true, result };
    } catch (error) {
      return { ok: false, error: error?.message || 'SANDBOX_ERROR', code: error?.code || 'SANDBOX_FAILED' };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function validateManifest(manifest) {
    if (!manifest || typeof manifest !== 'object') fail('INVALID_SANDBOX_MANIFEST');
    const risk = manifest.riskLevel;
    if (risk === 'high' && allowedWrite) {
      // High risk skills should not have write allowed by default
      return false;
    }
    return true;
  }

  return Object.freeze({ config, execute, validateManifest });
}

export const SANDBOX_DEFAULTS = Object.freeze({
  timeoutMs: DEFAULT_TIMEOUT_MS,
  memoryMb: DEFAULT_MEMORY_MB,
  cpuShares: DEFAULT_CPU_SHARES
});
