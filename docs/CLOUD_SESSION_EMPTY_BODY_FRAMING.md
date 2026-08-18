# Cloud session bodyless request framing contract

## Scope

This contract applies only to the Hafize cloud-session endpoints whose request semantics are intentionally bodyless:

- `GET /api/session/status`
- `POST /api/session/logout`

`POST /api/session/login` is not covered by this helper. Login keeps its separate strict JSON/UTF-8/body-size/timeout contract.

## Why this exists

Authentication endpoints should have one unambiguous request representation. A status check does not need a body, and logout intent is fully represented by the authenticated cookie plus the exact same-origin POST. Accepting extra framed bytes on those routes creates unnecessary parser/proxy ambiguity and makes it harder to reason about whether authentication or revocation can run before an unexpected body is rejected.

Hafize therefore fails closed before status authentication or logout revocation when a bodyless route carries non-empty or ambiguous body framing.

## Accepted framing

A bodyless cloud-session request may use:

- no `Content-Length`, or exactly one canonical `Content-Length: 0`;
- no `Transfer-Encoding` value;
- no `Content-Encoding`, an empty value, or `identity`.

Header-name matching is case-insensitive. Repeated logical framing headers represented through multiple differently-cased keys or array values are rejected rather than merged.

## Rejected framing

The following are rejected with bounded public `400 INVALID_REQUEST` plus `Connection: close`:

- non-zero `Content-Length`;
- non-canonical length forms such as `00`, whitespace-padded values, signed values, decimals, or lists;
- any non-empty `Transfer-Encoding`, including `chunked`;
- compressed `Content-Encoding` such as gzip, br, or deflate;
- repeated/array framing header representations;
- combinations such as `Content-Length: 0` plus `Transfer-Encoding: chunked`.

The internal reason code is not returned to the browser.

## Ordering

### Status

For the supported `GET` method, body framing is validated before `auth.authenticate`. Rejected framing therefore cannot cause session authentication work.

Unsupported status methods still return `405 METHOD_NOT_ALLOWED` before body handling.

### Logout

Logout remains a state-changing request and keeps this order:

1. route and method match (`POST` only);
2. exact configured HTTPS `Origin` is required;
3. empty-body framing is validated;
4. only then may server-side session revocation/authentication run;
5. only successful revocation may emit the clearing cookie.

A foreign or missing Origin cannot use framing errors as a way to reach revocation. Conversely, an authenticated same-origin request with ambiguous framing cannot revoke a session or receive a misleading successful logout response.

## Security boundaries preserved

This change does not add a new endpoint, cookie format, session permission, storage layer, network call, agent tool, connector capability, or external write permission. It does not read API keys or credentials and does not change active/previous signing-key rotation, logout revocation storage, login rate limiting, scrypt concurrency, or the four-profile agent roster.

Hafize continues to require backend default-deny tool authorization and explicit user approval for external write/send/merge operations. `.env`, credential files, and `.github/workflows/` remain outside self-development changes.

## Error policy

Body-framing violations expose only the fixed public body:

```json
{"error":"INVALID_REQUEST"}
```

The response requests connection closure because the server intentionally does not try to reinterpret or consume an unexpected body on a route that is contractually bodyless. Passwords, session tokens, cookie values, internal error codes, exception messages, and stack traces are never copied into this response.

## Regression coverage

The tests cover:

- absent and canonical zero `Content-Length`;
- transfer/content encoding rejection;
- repeated and array header representations;
- status authentication not running after framing rejection;
- logout revocation and clearing-cookie generation not running after framing rejection;
- method/origin/framing/auth ordering;
- fixed public error redaction;
- login body behavior remaining on its separate policy;
- active four-agent/default-deny security contract.

## Rollback

Revert `lib/cloud-session-empty-body-policy.mjs`, remove its two calls/import from `lib/cloud-session-http-api.mjs`, and remove the matching tests/documentation. No persistent data or schema migration is involved.
