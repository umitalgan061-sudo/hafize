# Çalışma Alanı Yedeği Son Kontrol Listesi

## Branch

hafize/auto-workspace-backup-0930 ana geliştirme branch'idir.

Main doğrudan değiştirilmemelidir.

PR üzerinden merge yapılmalıdır.

## Source

workspace-backup.ts mevcut olmalıdır.

Workspace backup test dosyası mevcut olmalıdır.

CSS dosyası mevcut olmalıdır.

Vite entry mevcut olmalıdır.

HTML entry mevcut olmalıdır.

PWA shell entries mevcut olmalıdır.

## Data

Allowlist key'leri mevcut olmalıdır.

Smart Fill prefix doğrulaması mevcut olmalıdır.

Sensitive key denylist'i mevcut olmalıdır.

Section count bounded olmalıdır.

Section size bounded olmalıdır.

Backup total size bounded olmalıdır.

## Export

Scope seçimleri görünmelidir.

Empty selection reddedilmelidir.

Selective payload oluşturulmalıdır.

SHA-256 digest yazılmalıdır.

Blob download yapılmalıdır.

Object URL revoke edilmelidir.

Metadata içerik taşımamalıdır.

## Import

File size önce kontrol edilmelidir.

JSON parse exception yakalanmalıdır.

Format kontrol edilmelidir.

Version kontrol edilmelidir.

Source kontrol edilmelidir.

Section allowlist kontrol edilmelidir.

Integrity kontrol edilmelidir.

Preview oluşturulmalıdır.

## Restore

Selection gerekli olmalıdır.

Confirmation gerekli olmalıdır.

Capture yapılmalıdır.

Apply yapılmalıdır.

Failure rollback denemelidir.

Warnings kullanıcıya aktarılmalıdır.

Related panels refresh event almalıdır.

## Security

No fetch.

No XMLHttpRequest.

No WebSocket.

No Authorization.

No Bearer.

No OAuth token storage.

No session storage export.

No secret storage export.

## Accessibility

aria-labelledby.

aria-live.

dialog semantics.

focus restoration.

focus-visible.

forced-colors.

reduced-motion.

keyboard shortcut guard.

## PWA

CSS shell asset.

JS shell asset.

Version bump.

API network-only policy.

Unique asset list.

## Tests

Core source test.

Security source test.

Integrity source test.

Restore source test.

UI source test.

PWA source test.

Limits source test.

Events source test.

Format source test.

Storage source test.

Regression source test.

Executable unit test.

## Docs

Product contract.

Data model.

Security.

Privacy.

Import export.

Restore rollback.

Accessibility.

Operations.

Failure modes.

QA.

Release.

User guide.

Support.

Threat model.

Migration.

Design review.

Checklist.

## Merge gate

Diff ölçümü yapılmalıdır.

3000+ anlamlı değişiklik hedefi kontrol edilmelidir.

Test sonucu açıkça yazılmalıdır.

GitHub PR mergeable durumu kontrol edilmelidir.

Merge SHA kaydedilmelidir.

Main ref doğrulanmalıdır.
