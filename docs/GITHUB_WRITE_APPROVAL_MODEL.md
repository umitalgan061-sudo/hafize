# GitHub write approval model

GitHub writes are intentionally split into approval and execution boundaries. A model-produced boolean is not an approval credential.

## Approval contract

The backend normalizes an allowlisted `branch.create`, branch-only `file.update`, draft-only `pr.create`, or head-SHA-pinned `pr.merge` command. It then issues a short-lived HMAC token bound to:

- authenticated connector owner scope,
- repository,
- operation,
- every normalized operation parameter,
- expiry and a random nonce.

The token is single-use. A changed branch, file path, expected blob SHA, commit message, file-content digest, PR title, PR number, expected merge head SHA, repository, or authenticated user cannot reuse it. Invalid or expired tokens fail before a writer callback is invoked.

Production replay protection is shared across server instances. `HAFIZE_GITHUB_WRITE_REPLAY_REDIS_URL` configures a server-held Redis endpoint; execution atomically claims a domain-separated SHA-256 digest of the approval nonce with `SET NX` and a TTL no longer than the token lifetime. The raw nonce and approval token are never stored as Redis keys or values. If Redis is unavailable, execution fails closed with `GITHUB_WRITE_REPLAY_STORE_UNAVAILABLE` and the GitHub writer is not called.

The replay Redis client is lazy, uses a bounded 5-second connection attempt, and disables the client's automatic reconnect loop. The store may create a fresh client on a later request after a failed connection, but once the runtime enters `close()` it becomes terminal: pending connects are interrupted, an active client is closed once, repeated close calls share the same promise, and later approval consumption cannot reconnect or reach GitHub.

The low-level approval boundary retains an in-process replay store only for isolated/embedded use and unit tests. Production server composition always injects the shared Redis replay store, so a process restart or a second cloud instance cannot make an already consumed approval reusable.

`approvalGranted` is backend execution state, not request data. Public callers cannot set that field to authorize themselves.

## Execution contract

The execution boundary consumes the exact approval immediately before the injected GitHub writer is called. `file.update` is limited to `hafize/*` branches, requires an exact existing blob SHA, accepts at most 64 KiB of non-empty UTF-8 content, and blocks secret-like paths plus `.github/workflows/`. A writer failure still spends the token; retrying a side effect requires a fresh user approval. Pre-aborted requests do not consume the approval.

Writer receipts are reduced to fixed public fields and provider failures become `GITHUB_WRITE_EXECUTION_FAILED`. Provider tokens, filesystem paths, headers, raw API responses, principal subjects, owner IDs, and the approval token are never passed back as public execution data.

## Deployment boundary

The production Node server exposes only the explicit opt-in `/api/github/write/prepare` and `/api/github/write/execute` routes. Activation requires exact `HAFIZE_GITHUB_WRITE_ENABLED=true`, a dedicated repository allowlist, server-held GitHub/auth/approval/owner secrets, and `HAFIZE_GITHUB_WRITE_REPLAY_REDIS_URL`. The write runtime remains outside the model tool catalog and agent permission context. Self-development still never writes directly to `main` or modifies `.github/workflows` automatically.

On `SIGINT` or `SIGTERM`, the server first stops accepting new HTTP work and lets active HTTP requests drain through the existing server-close boundary. It then closes the GitHub write runtime, which closes the shared replay Redis client. Shutdown failure is surfaced through a non-zero process exit code without exposing Redis credentials.
