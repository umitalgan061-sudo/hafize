# Security Acceptance

Aşağıdaki koşullar release için gereklidir:

- Unknown key preservation.
- Allowlist-only deletion.
- Content-free report.
- No network transport.
- No global localStorage.clear.
- Bounded scan.
- Bounded report.
- Explicit destructive confirmations.
- Safe DOM text insertion.
- PWA asset separation.

Bir koşul başarısızsa PR merge edilmez.
