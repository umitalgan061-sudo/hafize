# Scheduled task caller cancellation contract

Hafize schedule execution may be cancelled for two independent infrastructure reasons:

1. the lease can be lost while a task is running;
2. the caller can explicitly abort the execution through an `AbortSignal`.

These are intentionally distinct outcomes. Lease loss means another worker may own the task and therefore returns `SCHEDULE_LEASE_LOST`. Caller cancellation means the current execution was intentionally stopped and returns `SCHEDULE_EXECUTION_CANCELLED` after the active lease is safely released.

## Required behavior

- A caller signal that is already aborted must stop before lease acquisition.
- A signal that becomes aborted while lease acquisition is in flight must release a newly acquired lease before any agent work begins.
- While agent work is running, caller cancellation must abort the signal passed into the agent executor.
- Once caller cancellation is observed, future lease renewals stop.
- A cancelled execution must never call `lease.complete`.
- Its lease is released exactly through the existing fenced release contract.
- If that release reports `stale`, lease loss wins and the public infrastructure result is `SCHEDULE_LEASE_LOST`.
- If the lease has already been completed by another valid holder, the existing deduplicated completed result wins.
- A malformed signal fails closed as `INVALID_SCHEDULE_AGENT_TASK` before lease acquisition.

## Why this is needed

The lease guard previously created its own `AbortController` and replaced any signal supplied by its caller. Lease-loss cancellation therefore reached the running agent, but a service shutdown or higher-level cancellation did not. A cancelled caller could continue consuming NVIDIA/provider time until the agent finished naturally.

The guard now composes the caller's cancellation into its execution controller without weakening fencing. This is a transport/lifecycle change only; it does not grant any new agent tools or external write permissions.

## Security invariants

- The four-profile selector/specialist roster is unchanged.
- Tool authorization remains backend default-deny.
- External write/send/merge operations still require their existing explicit approval boundaries.
- Cancellation reasons are not treated as new commands or agent input.
- Secret, credential, cookie and OAuth material never enters this cancellation path.
- No shell, terminal, `exec`, `spawn`, `.env` or `.github/workflows/` behavior is introduced.

## Follow-up boundary

The production scheduled NVIDIA callback in `server.mjs` still owns its own timeout controller. Passing the composed signal into that callback is a separate integration step: timeout and caller/lease cancellation must be linked so an already-cancelled scheduled run also terminates the underlying provider request, not merely the agent promise waiting for it.
