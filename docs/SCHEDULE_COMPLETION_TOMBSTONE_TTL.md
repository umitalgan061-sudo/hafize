# Schedule Completion Tombstone TTL

Redis lease coordination uses a per-schedule `completed` tombstone to prevent a completed schedule from being acquired again after its live lease key disappears. The tombstone is an idempotency guard, not permanent business data.

## Problem

Previously the Redis completion Lua script wrote the tombstone with an unbounded `SET`. Every distinct completed schedule could therefore leave a Redis key behind forever. A continuously running cloud scheduler would accumulate these keys without a retention boundary.

## Policy

Completion tombstones are now written atomically with Redis `PX` expiry.

Default retention: **7 days**.

Allowed configuration range:

- minimum: **1 hour**;
- maximum: **30 days**.

The optional environment setting is `HAFIZE_SCHEDULE_LEASE_COMPLETION_TTL_MS`. If omitted, the seven-day default is used. If supplied, it must be a decimal integer inside the bounded range. Invalid or partial lease configuration fails closed during startup.

## Atomic completion

The completion Lua script still verifies the exact holder + fencing token before changing Redis state. On a valid completion it performs the tombstone write with its TTL and deletes the live lease in the same script execution. There is no separate best-effort expiry call that could be skipped after a process crash.

The existing statuses remain unchanged:

- `completed`: this holder successfully committed completion;
- `already_completed`: a tombstone is already present;
- `stale`: holder/fence no longer owns the live lease.

## Retention tradeoff

The tombstone prevents duplicate acquisition only while it exists. A bounded TTL intentionally avoids claiming permanent idempotency. Hafize schedule IDs are expected to be unique; reusing a completed schedule ID after the tombstone expires is outside this lease-level guarantee.

The TTL must therefore be long enough to cover normal delayed duplicate workers and deployment overlap while still bounding Redis growth. Seven days is the conservative default; operators may choose between one hour and thirty days according to their deployment model.

## Configuration propagation

`readScheduleLeaseRuntimeConfig()` validates the TTL together with provider, holder ID, lease duration and renew interval. The provider runtime passes the validated number to the Redis adapter factory. The Redis adapter independently validates its direct constructor input so bypassing the config reader cannot introduce an unbounded TTL.

## Security boundaries

This change does not:

- change the four-profile agent registry;
- grant new agent tools;
- weaken backend default-deny enforcement;
- bypass explicit approval for external write/send/merge actions;
- expose Redis credentials or any secret to agent context;
- add a browser/client configuration surface;
- add a new network endpoint;
- add persistent personal memory writes;
- introduce shell, exec, spawn or general command execution;
- modify `.env`, credential files or `.github/workflows/`.

The tombstone contains the existing bounded idempotency key and remains server-side in Redis.

## Failure behavior

Malformed TTL configuration fails closed with the existing sanitized lease configuration error. Redis command failures continue to surface only as the bounded `REDIS_SCHEDULE_LEASE_FAILED` error; raw Redis details are not exposed through this change.

## DoD

Tests must verify:

1. the default TTL is seven days;
2. exact minimum and maximum values are accepted;
3. values outside the range and non-integer text are rejected;
4. the completion Lua script uses atomic `SET ... PX`;
5. the exact validated TTL reaches Redis as a script argument;
6. runtime/provider wiring passes the TTL to the adapter;
7. holder/fence/idempotency semantics remain unchanged;
8. no client-side secret or tool-permission surface is added.

## Relation to task storage

This TTL applies only to the Redis coordination tombstone. It does not delete the durable schedule record itself and does not change task history retention in the schedule storage adapter. Those are separate data-lifecycle concerns.
