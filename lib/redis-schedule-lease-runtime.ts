interface RedisClientLike { isOpen?: boolean; quit?: () => Promise<unknown>; disconnect?: () => void }
interface RedisModuleLike { createClient?: (options?: unknown) => unknown }
interface RedisLeaseOptions { env?: Record<string,string|undefined>; loadRedisModule?: () => Promise<RedisModuleLike>; createClientRuntime?: (...args:any[])=>Promise<any>; createAdapter?: (...args:any[])=>any; createProviderRuntime?: (...args:any[])=>Promise<any> }
import { createRedisLeaseClient, readRedisLeaseClientConfig } from './redis-lease-client-factory.mjs';
import { createRedisScheduleLeaseAdapter } from './redis-schedule-lease-adapter.mjs';
import {
  createScheduleLeaseProviderRuntime,
  readScheduleLeaseRuntimeConfig
} from './schedule-lease-runtime-config.mjs';

async function defaultLoadRedisModule(): Promise<RedisModuleLike> {
  return import('redis');
}

async function closeClient(client: RedisClientLike | null | undefined): Promise<void> {
  if (!client) return;
  try {
    if (typeof client.quit === 'function' && client.isOpen) await client.quit();
    else if (typeof client.disconnect === 'function' && client.isOpen) client.disconnect();
  } catch {
    throw new Error('REDIS_LEASE_RUNTIME_CLOSE_FAILED');
  }
}

export async function createRedisScheduleLeaseRuntime({
  env = process.env,
  loadRedisModule = defaultLoadRedisModule,
  createClientRuntime = createRedisLeaseClient,
  createAdapter = createRedisScheduleLeaseAdapter,
  createProviderRuntime = createScheduleLeaseProviderRuntime
}: RedisLeaseOptions = {}) {
  if (typeof loadRedisModule !== 'function') throw new Error('INVALID_REDIS_LEASE_RUNTIME:loadRedisModule');
  if (typeof createClientRuntime !== 'function') throw new Error('INVALID_REDIS_LEASE_RUNTIME:createClientRuntime');
  if (typeof createAdapter !== 'function') throw new Error('INVALID_REDIS_LEASE_RUNTIME:createAdapter');
  if (typeof createProviderRuntime !== 'function') throw new Error('INVALID_REDIS_LEASE_RUNTIME:createProviderRuntime');

  const leaseConfig = readScheduleLeaseRuntimeConfig(env);
  if (leaseConfig == null) {
    const disabled = await createProviderRuntime({ env, providerFactories: {} });
    return Object.freeze({ ...disabled, close: async () => undefined });
  }
  if (leaseConfig.provider !== 'redis') throw new Error('SCHEDULE_LEASE_PROVIDER_UNAVAILABLE');

  const redisConfig = readRedisLeaseClientConfig(env);
  if (redisConfig == null) throw new Error('SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED');

  let client: RedisClientLike | null = null;
  let closed = false;
  try {
    const redisModule: RedisModuleLike = await loadRedisModule();
    const createClient = redisModule?.createClient;
    if (typeof createClient !== 'function') throw new Error('redis module unavailable');

    const clientRuntime = await createClientRuntime({ env, createClient });
    if (!clientRuntime?.configured || !clientRuntime.client) throw new Error('redis client unavailable');
    client = clientRuntime.client;

    const runtime = await createProviderRuntime({
      env,
      providerFactories: {
        redis: async () => createAdapter({ redis: client })
      }
    });
    if (!runtime?.configured || runtime.provider !== 'redis' || !runtime.lease) {
      throw new Error('invalid lease runtime');
    }

    async function close() {
      if (closed) return;
      closed = true;
      await closeClient(client);
    }

    return Object.freeze({
      configured: true,
      provider: runtime.provider,
      lease: runtime.lease,
      renewIntervalMs: runtime.renewIntervalMs,
      close
    });
  } catch (error) {
    if (client) {
      try {
        await closeClient(client);
      } catch {
        // Startup cleanup must not replace the sanitized root error.
      }
    }
    if (error?.message === 'SCHEDULE_LEASE_PROVIDER_UNAVAILABLE') throw error;
    throw new Error('SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED');
  }
}
