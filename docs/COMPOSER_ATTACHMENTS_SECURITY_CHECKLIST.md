# Composer Ekleri — Security Checklist

## Input
[ ] extension allowlist
[ ] filename normalization
[ ] byte limit before read
[ ] character limit after normalize
[ ] total queue limit
[ ] binary guard
[ ] line range clamp

## Output
[ ] safe DOM text nodes
[ ] fence collision handled
[ ] composer maxlength respected
[ ] no partial write
[ ] no automatic submit

## Storage
[ ] no localStorage content
[ ] no sessionStorage content
[ ] no IndexedDB
[ ] no Cache API user content

## Network
[ ] no fetch
[ ] no XMLHttpRequest
[ ] no WebSocket
[ ] no Beacon

## Secret scan
[ ] private key pattern
[ ] token patterns
[ ] JWT pattern
[ ] confirmation required for risky selection
[ ] findings do not echo full secret

## Lifecycle
[ ] expiry timer exists
[ ] timer cleared on expiry
[ ] timer cleared on destroy
[ ] listeners removable

## PWA
[ ] asset list updated
[ ] cache version incremented
[ ] API remains network-only