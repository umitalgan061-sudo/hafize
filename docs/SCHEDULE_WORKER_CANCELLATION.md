# Schedule worker cancellation and attempt refund

The schedule worker accepts an optional caller `AbortSignal` at `runDue` and propagates it to every claimed task execution.

## Contract

- A pre-aborted run returns without calling `store.claimDue`.
- A signal that aborts after claim is propagated to the task executor.
- Claimed tasks observed after cancellation are deferred instead of executed when the durable store supports `defer`.
- Cancellation uses the fixed public code `SCHEDULE_EXECUTION_CANCELLED`.
- A cancellation defer refunds the claim-time attempt and schedules the task with its existing bounded retry delay.
- Provider/private exception text is never substituted for the fixed cancellation code after the caller signal is aborted.
- Existing lease infrastructure errors `SCHEDULE_LEASE_BUSY` and `SCHEDULE_LEASE_LOST` retain their separate refundable behavior and bounded retryAt horizon.
- Ordinary model/tool failures still consume attempts exactly as before.
- If an older/custom store lacks `defer`, cancellation falls back to the existing failure/retry path instead of pretending an attempt was refunded.
- Malformed signals fail before any task claim.

## Why

A bounded worker can be asked to stop during deploy, shutdown or higher-level execution cancellation. Before this contract, `runDue` had no caller signal surface. Once a batch was claimed, every task would continue through the executor even if the caller no longer wanted the tick to proceed.

Combined with `SCHEDULE_CALLER_CANCELLATION.md`, cancellation can now flow from worker -> execution runtime -> lease guard -> scheduled agent. This prepares the lifecycle for a production shutdown controller without changing provider or tool permissions.

## Safety boundaries

- Cancellation never marks a task completed.
- Claimed attempts are refunded only through the store's existing `defer` contract.
- Retry delay remains bounded to the existing schedule limits.
- No new external write/send/merge permission is introduced.
- The four-agent selector/specialist roster and shared trace/task-ledger model remain unchanged.
- No secret, credential, cookie, shell command or provider error body is added to task state.

## Remaining production integration

`server.mjs` currently invokes `SCHEDULE_WORKER.runDue()` without a shutdown signal, and the scheduled NVIDIA completion callback owns a separate timeout controller. A final production integration should use one shutdown controller for schedule ticks and compose that signal with the NVIDIA timeout so process shutdown/lease loss can terminate the underlying provider request as well as the waiting agent promise.
