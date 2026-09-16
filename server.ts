import { readRuntimeConfig, validateRuntimeConfig } from './lib/runtime-config.ts';

type BootstrapResult = Readonly<{ config: ReturnType<typeof readRuntimeConfig>; validation: ReturnType<typeof validateRuntimeConfig> }>;

export function createRuntimeBootstrap(env: NodeJS.ProcessEnv = process.env): BootstrapResult {
  const config = readRuntimeConfig(env);
  const validation = validateRuntimeConfig(config);
  if (!validation.ok) throw new Error(`INVALID_RUNTIME_CONFIG:${validation.errors.join(',')}`);
  return Object.freeze({ config, validation });
}

const bootstrap = createRuntimeBootstrap();
if (bootstrap.config.nodeMajor < 24) throw new Error('NODE_VERSION_TOO_OLD');
await import('./server-runtime.mjs');
