# Modern Runtime Checklist

## Architecture

- `server.ts` canonical entrypoint.
- `server-runtime.mjs` legacy HTTP engine boundary.
- critical response/auth/failure modules have TypeScript canonical implementations.
- legacy `.mjs` files are export bridges only.

## Configuration

- Node 24+ is required.
- NIM URL must be HTTPS.
- request body limit is bounded.
- upstream timeout is bounded.
- scheduler timeout is bounded.
- environment parsing uses safe defaults.

## TypeScript

- NodeNext module resolution is enabled for the Node profile.
- TypeScript source is not exposed by static serving.
- `erasableSyntaxOnly` is enabled.
- Node types are explicitly selected.
- browser and server compilation profiles remain separate.

## Security

- no secret literals in migrated runtime modules.
- error detail does not cross the public response boundary.
- model content and tool calls are normalized before use.
- bearer comparison is timing-safe.
- path traversal is blocked.
- `.ts` source is blocked from static serving.

## Runtime

- client disconnect can abort in-flight work.
- upstream request has a maximum lifetime.
- SSE failure is protocol-safe after headers are sent.
- scheduler does not overlap ticks.
- shutdown is idempotent.
- idle HTTP connections are closed.

## Observability

- request metrics are numeric summaries only.
- request body is never stored in metrics.
- model output is never stored in metrics.
- credentials are never stored in metrics.
- immutable snapshots are returned.
- active and peak concurrency are visible.

## Compatibility

- legacy `node server.mjs` remains usable.
- public API route names stay unchanged.
- error codes stay stable.
- storage formats are unchanged.
- connector scopes are unchanged.

## Testing

- typecheck command includes the Node profile.
- modern tests are part of `check:modern`.
- legacy entry contract is part of `check:modern`.
- runtime security contract is part of `check:modern`.
- package points production to `server.ts`.

## Release

- branch is `hafize/auto-*`.
- no self-development change is committed directly to `main`.
- no `.env` or secret file is changed.
- diff remains below 3000 changed lines.
- rollback path is documented.
