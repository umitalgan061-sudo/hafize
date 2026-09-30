# GitHub Güvenli Yazma Release Checklist

## Kod
- Writer backend yalnız GitHub write API'lerini çağırıyor.
- Read workspace davranışı değiştirilmedi.
- Write allowlist ayrı environment değişkeni olarak tanımlı.
- Default branch direct commit policy server-side çalışıyor.
- Workflow ve secret dosya yolları kapalı.

## UI
- Kullanıcı write action'ı seçiyor.
- Plan görünür durumda.
- Explicit approval olmadan execution disabled.
- Başarılı sonuç güvenli alanlarla gösteriliyor.
- History yalnız contentless metadata tutuyor.

## Güvenlik
- Session authentication ve CSRF guard aktif.
- Approval ticket iki dakikadan kısa ömürlü ve tek kullanımlık.
- Ticket Map bounded.
- Payload fingerprint approval'a bağlı.
- Browser GitHub tokenı görmüyor.

## PWA
- CSS ve typed JS shell cache listesinde.
- API cevapları cache'e alınmıyor.
- Cache version bump edildi.

## Release kanıtı
- Vitest writer suite repository'ye ekli.
- Source contract, security, API, UI, PWA ve rollback gate'leri repository'ye ekli.
- Hosted workflow bulunmuyorsa release notunda bunun ayrıca belirtilmesi gerekir.
