# Çalışma Alanı Yedeği Release Checklist

## Kod

Workspace backup TypeScript entry mevcut olmalıdır.

Pure functions export edilmiş olmalıdır.

UI mount controller export edilmiş olmalıdır.

Storage allowlist explicit olmalıdır.

Sensitive denylist korunmalıdır.

Restore confirmation mevcut olmalıdır.

Rollback path mevcut olmalıdır.

Export selection mevcut olmalıdır.

## Build

Vite entry map güncel olmalıdır.

Development transform güncel olmalıdır.

Production bundle entry mevcut olmalıdır.

HTML module tag mevcut olmalıdır.

CSS link mevcut olmalıdır.

Service worker shell listesi güncel olmalıdır.

Cache version feature değişimiyle artırılmalıdır.

## Test

Workspace backup unit test dosyası mevcut olmalıdır.

Workspace backup core source test mevcut olmalıdır.

Security source test mevcut olmalıdır.

Integrity test mevcut olmalıdır.

Restore test mevcut olmalıdır.

UI test mevcut olmalıdır.

PWA test mevcut olmalıdır.

Limits test mevcut olmalıdır.

Events test mevcut olmalıdır.

Regression test mevcut olmalıdır.

## Documentation

Ana ürün sözleşmesi yayınlanmalıdır.

Data model belgelenmelidir.

Security belgelenmelidir.

Privacy belgelenmelidir.

Import export belgelenmelidir.

Restore rollback belgelenmelidir.

Accessibility belgelenmelidir.

Operations runbook bulunmalıdır.

Failure modes bulunmalıdır.

QA planı bulunmalıdır.

User guide bulunmalıdır.

## Browser smoke

Chrome veya Edge üzerinde panel görünmelidir.

Mobil viewport davranışı kontrol edilmelidir.

Keyboard shortcut kontrol edilmelidir.

Forced colors kontrol edilmelidir.

Reduced motion kontrol edilmelidir.

Download dosyası oluşmalıdır.

Import file chooser çalışmalıdır.

Preview listesi görünmelidir.

Restore confirmation görünmelidir.

Restore sonrası refresh gerçekleşmelidir.

## Security sign-off

No network request.

No auth token export.

No credential export.

No OAuth state export.

No session export.

No raw HTML sink.

No uncontrolled storage wildcard.

No automatic destructive restore.

## Rollout

Feature mevcut local state'i migration yapmaz.

Yeni metadata key yalnız export sonrasında oluşturulur.

Panel görünmemişse mevcut app davranışı devam eder.

Import/restore kullanıcı başlatması olmadan başlamaz.

PWA cache yeni asset'leri release ile taşır.

## Rollback

PR revert ile özellik kaldırılabilir.

Mevcut workspace data migration yapılmadığı için korunur.

Backup dosyası bağımsız recovery kaynağıdır.

Metadata key zararlı bir veri silme tetikleyicisi değildir.

Rollback sonrası uygulama eski panellerine döner.

## Versioning

Backup format version 1 olarak korunmalıdır.

Breaking schema değişikliğinde version artırılmalıdır.

Yeni section kind explicit allowlist gerektirir.

Eski parser gelecekte bilinmeyen section'ları restore etmemelidir.

## Release decision

Build gate başarılı.

Unit tests başarılı.

Source contracts başarılı.

PWA contracts başarılı.

Security contracts başarılı.

Manual smoke başarılı.

Documentation güncel.

Bu koşullar sağlanmadan özelliğin production-ready olduğu kabul edilmemelidir.
