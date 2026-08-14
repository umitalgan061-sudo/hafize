# Redis Schedule Lease Server Wiring

`server.mjs` now composes the optional Redis schedule lease runtime before the schedule worker starts.

## Startup order

1. Encrypted schedule storage runtime opens.
2. Optional Redis schedule lease runtime starts and, when configured, connects and validates Redis.
3. The scheduled-agent executor is wrapped by `createScheduleExecutionRuntime()` with the lease boundary.
4. The worker receives only the resulting execution function.
5. The HTTP server begins listening after all startup boundaries above succeed.

If lease configuration is absent, the execution runtime remains an unguarded passthrough and no Redis module or connection is required. If Redis lease configuration is present but incomplete or unavailable, startup fails closed before `/api/health` is exposed.

## Health

`/api/health` reports only `scheduleLeaseConfigured: true|false`. Provider URLs, credentials, holder identifiers, fencing tokens, and lease state are not returned.

## Shutdown

SIGINT and SIGTERM stop future schedule ticks, wait for an in-flight tick to settle, close the Redis lease runtime, and close the HTTP server. Redis shutdown errors are sanitized and only a generic server log line is emitted.

## Security boundary

Redis credentials remain server-side. They are not added to agent context, schedule payloads, frontend/PWA code, health responses, or task ledgers. Existing external write/send/merge approval behavior is unchanged.
