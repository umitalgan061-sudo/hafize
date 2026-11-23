/** Server-only Cloud Run credential validation. Never print secret contents. */
import { pathToFileURL } from 'node:url';

export function validateCloudRunSecrets(env = {}) {
  const auth = String(env.HAFIZE_CLOUD_RUN_AUTH_TOKEN || '');
  const master = String(env.HAFIZE_CLOUD_RUN_MASTER_KEY || '').trim();
  const nvidia = String(env.HAFIZE_CLOUD_RUN_NVIDIA_API_KEY || '').trim();
  if (auth.length < 32 || auth.length > 4096 || /\s/.test(auth)) {
    throw new Error('HAFIZE_CLOUD_RUN_AUTH_TOKEN_MISSING_OR_INVALID');
  }
  if (!/^[0-9a-f]{64}$/i.test(master) &&
    !(/^[A-Za-z0-9+/]{43}=$/.test(master) && Buffer.from(master, 'base64').length === 32)) {
    throw new Error('HAFIZE_CLOUD_RUN_MASTER_KEY_MISSING_OR_INVALID');
  }
  if (!nvidia || /\s/.test(nvidia)) {
    throw new Error('HAFIZE_CLOUD_RUN_NVIDIA_API_KEY_MISSING_OR_INVALID');
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    validateCloudRunSecrets(process.env);
    console.log('Cloud Run backend secrets are configured and structurally valid (values hidden).');
  } catch (error) {
    console.error('::error::' + String(error?.message || 'CLOUD_RUN_BACKEND_PREFLIGHT_FAILED'));
    process.exitCode = 1;
  }
}
