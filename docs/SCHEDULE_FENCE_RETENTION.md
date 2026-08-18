# Schedule Fence Retention

Redis schedule leases use a monotonically increasing fencing counter per schedule ID. The fence prevents a stale holder from completing or releasing a lease after a newer holder has acquired the same schedule.

## Problem

The fence counter was created with `INCR` but never expired. Even after the live lease disappeared and the bounded completion tombstone expired, the fence key could remain in Redis forever. A long-running scheduler with unique schedule IDs would therefore accumulate permanent fence metadata.

## Policy

Fence metadata now receives the same bounded retention window as the completion tombstone. The validated `completionTtlMs` value is reused rather than introducing a second independent retention setting.

The fence TTL is refreshed atomically inside the Redis Lua scripts when:

- a lease is acquired;
- an owned lease is renewed;
- an owned execution is completed;
- an owned lease is released without completion.

Default retention remains seven days with the already validated one-hour to thirty-day range.

## Fencing semantics

This change does not replace or weaken the fencing token check. `renew`, `complete` and `release` still require the exact `holderId|fence` token currently stored in the live lease key. A stale holder cannot extend fence retention or mutate the live lease because the script returns `stale` before the `PEXPIRE` operation.

On acquire, Redis increments the fence before setting its retention. While a schedule is actively leased or retried inside the retention window, subsequent acquisitions continue to receive increasing fence numbers.

After both live coordination and the bounded retention window have ended, Redis may discard the old fence counter. Reusing the same schedule ID after that point is outside the lease-level long-term idempotency guarantee. Hafize schedule IDs are expected to be unique.

## Why reuse completion TTL

Fence and completion metadata protect the same delayed-duplicate coordination window. Sharing one validated retention value avoids inconsistent configurations where a completion tombstone outlives its fence history or vice versa.

The retention window is much longer than the live lease maximum of fifteen minutes and the normal bounded retry delays. It is not a substitute for durable task history.

## Failure and security boundaries

All TTL updates occur inside the same Redis scripts as their associated lease operation. There is no follow-up best-effort cleanup request whose failure could silently leave an unbounded key.

This change does not:

- change the four-profile agent roster;
- add or broaden agent tools;
- change backend default-deny enforcement;
- bypass external write/send/merge approvals;
- expose Redis credentials, provider keys or tokens;
- add a browser endpoint or client storage;
- add persistent personal memory writes;
- introduce shell, exec, spawn or command execution;
- modify `.env`, credential files or `.github/workflows/`.

## DoD

Tests verify that acquire, renew, complete and release scripts all apply bounded fence retention with the exact validated TTL; that completion still uses its own atomic `SET ... PX`; and that holder/fence ownership checks remain before state mutation.

## Relationship to completion tombstones

The completion tombstone prevents a recently completed schedule from being reacquired. Fence retention prevents coordination metadata from becoming permanent. Both are bounded Redis coordination state; neither removes the durable schedule record or changes schedule API history.
