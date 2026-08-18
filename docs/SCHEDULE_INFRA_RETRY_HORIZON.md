# Schedule Infrastructure Retry Horizon

Schedule worker can accept a `retryAt` suggestion from the lease coordination result for refundable infrastructure failures. This timestamp must not be allowed to park a task indefinitely.

## Policy

Only `SCHEDULE_LEASE_BUSY` and `SCHEDULE_LEASE_LOST` use the refundable infrastructure path. A supplied `retryAt` is accepted only when it is:

- parseable as a timestamp;
- strictly in the future relative to the worker clock;
- no more than **24 hours** in the future.

A missing, invalid, past, equal or more-than-24-hour value is ignored. The worker then uses the task's already bounded `retryDelayMs`, or its bounded fallback delay.

The exact 24-hour boundary is accepted. Values even one millisecond beyond it are rejected.

## Why

The normal Redis lease adapter returns a short retry time derived from the live lease TTL. The worker still treats adapter output as a boundary input. Without a horizon check, a corrupted or future alternative lease provider could return a valid date years ahead and effectively orphan an otherwise healthy scheduled task.

## Security and behavior boundaries

This change does not create retries for new error classes. Exact refundable-error classification remains unchanged, attempt refund behavior remains unchanged, and provider/tool execution failures continue through the normal retry/fail path.

No agent permissions, external write approvals, secrets, endpoints, storage formats, provider fallback, persistent memory writes or shell execution are added. The four-profile selector/specialist registry and backend default-deny tool policy remain unchanged.

## DoD

Tests verify acceptance of the exact 24-hour boundary and fallback for 24 hours plus one millisecond, multi-day timestamps and extreme future dates. Fallback must preserve attempt refund and use the configured bounded task retry delay.
