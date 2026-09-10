# HTTP request failure boundary

Hafize HTTP handlers can fail before a response starts, after SSE headers are committed, or after the client has disconnected. `lib/request-failure.mjs` centralizes that distinction so an error handler never blindly tries to send JSON over an already-started stream.

## Delivery states

- `closed`: response is already destroyed, ended, or closed. No write is attempted.
- `aborted`: the failure is a client/socket cancellation such as `AbortError`, `ECONNRESET`, or `EPIPE`. No synthetic error frame is emitted.
- `json`: headers have not been committed. A bounded public error response is written.
- `stream`: headers are already committed. A safe SSE error frame is attempted and the stream is closed without invoking `writeHead()` again.

## Public error contract

The boundary preserves `BODY_TOO_LARGE` (413), `NVIDIA_NOT_CONFIGURED` (503), `NVIDIA_CHAT_ERROR` (validated 4xx/5xx status), `INVALID_NVIDIA_RESPONSE` (502), `INVALID_JSON` (400), and otherwise `INTERNAL_ERROR` (500). Unknown implementation details are never exposed. Upstream provider detail is never returned to the client, on either the JSON or the stream path.

Invalid or successful upstream statuses are not accepted as public failure status codes; the fallback is 502. Provider diagnostic text stays server-side; `REQUEST_FAILURE_CONTRACT.maxNvidiaDetail` only bounds how much of it a caller may retain for its own logs. Both JSON and streamed failures expose just the stable public error code.

## Integration rule

Route-level handlers should call `deliverRequestFailure(res, error)` from their outer catch or stream catch. The boundary itself must tolerate `res.write()` / `res.end()` throwing, because a peer can disappear between classification and delivery.

This layer does not change authentication, tool permissions, model selection, or user consent semantics. It only makes response delivery state-aware and fail-closed.
