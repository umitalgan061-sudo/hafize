# Çalışma Alanı Yedeği QA Planı

## Test katmanları

Unit testler pure backup fonksiyonlarının kritik davranışını doğrular.

Source contract testleri browser source sınırlarını doğrular.

Integration seviyesinde Vite, HTML ve service worker uyumu kontrol edilir.

Manual smoke ile gerçek browser etkileşimi doğrulanır.

## Unit kapsamı

collectSections allowlist test edilir.

allowedStorageKey sensitive key testi yapılır.

createBackup selective export testi yapılır.

inspectBackup valid JSON testi yapılır.

inspectBackup tampered digest testi yapılır.

restoreSelected success testi yapılır.

restoreSelected rollback testi yapılır.

formatBytes çıktı testi yapılır.

backupMetadata round trip testi yapılır.

## Data tests

Prompt section JSON array kabul edilmelidir.

Conversation section JSON object veya array olabilir.

State section primitive object değer taşıyabilir.

Smart Fill section entries array taşımalıdır.

Unknown section parse edilse bile restore'a girmemelidir.

Skipped metadata string list olarak normalize edilmelidir.

## Boundary tests

2 MB altı backup kabul edilmelidir.

2 MB üstü backup reddedilmelidir.

1.2 MB üstü section reddedilmelidir.

32 section üstü payload bounded olmalıdır.

24 Smart Fill entry üstü bounded olmalıdır.

180 karakterden uzun key bounded olmalıdır.

## Integrity tests

Valid SHA-256 verified olmalıdır.

Digest değişikliğinde failed dönmelidir.

Integrity olmayan belge unverified olabilir.

Crypto unavailable olduğunda exception UI'yi kilitlememelidir.

Failed integrity restore disabled olmalıdır.

## Restore tests

Tek section restore.

Selective restore.

Multi section restore.

Cancel confirmation.

Quota failure.

Rollback success.

Rollback warning.

Smart Fill restore.

Unselected state preservation.

## Security tests

Network API olmamalıdır.

Authorization header olmamalıdır.

Credential key restore edilmemelidir.

Token key restore edilmemelidir.

Session key restore edilmemelidir.

OAuth key restore edilmemelidir.

innerHTML sink'i kullanılmamalıdır.

## Accessibility tests

Panel aria-labelledby taşımalıdır.

Status aria-live taşımalıdır.

Preview dialog semantics taşımalıdır.

Checkbox label ile bağlanmalıdır.

Focus visible CSS bulunmalıdır.

Reduced motion bulunmalıdır.

Forced colors bulunmalıdır.

Shortcut editable controls içinde çalışmamalıdır.

## PWA tests

Vite workspace backup entry içermelidir.

HTML typed-build entry içermelidir.

Service worker CSS'i cache etmelidir.

Service worker JS'i cache etmelidir.

API path shell cache'e girmemelidir.

Cache version numeric olmalıdır.

## Manual smoke

Boş profilde panel açılır.

Yalnız prompt bulunan profilde kapsam listesi doğru görünür.

Birden fazla yüzey seçilip export edilir.

Downloaded JSON parse edilir.

Import preview açılır.

Bir yüzey seçilir.

Restore confirmation alınır.

Restore sonrası ilgili UI refresh olur.

## Regression

Mevcut Prompt Library çalışmalıdır.

Collections çalışmalıdır.

Revisions çalışmalıdır.

Model Preferences çalışmalıdır.

Composer History çalışmalıdır.

Scheduled Task Templates çalışmalıdır.

Conversation Forks çalışmalıdır.

Backup paneli bu yüzeylerin state key'lerini değiştirmemelidir.

## Release sign-off

TypeScript typecheck temiz olmalıdır.

Vitest unit testleri temiz olmalıdır.

Legacy syntax testleri temiz olmalıdır.

Workspace backup source testleri temiz olmalıdır.

PWA contract temiz olmalıdır.

Security contract temiz olmalıdır.

Manual smoke başarılı olmalıdır.
