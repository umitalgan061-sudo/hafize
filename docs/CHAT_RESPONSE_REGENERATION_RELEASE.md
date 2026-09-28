# Yanıt Regeneration Release Checklist

## Kod
- Typed source güncel.
- Alternatif geçmişi bounded.
- Feedback enum kontrollü.
- Generation metadata sanitize ediliyor.
- Legacy bridge genişletilmiyor.

## UI
- Action buttons mobilde wrap olur.
- Disabled durumları anlaşılır.
- Focus-visible korunur.
- Clipboard hatası kullanıcıya gösterilir.

## Test
- source contract
- data model
- accessibility
- security
- no-submit
- regression
- typecheck
- build

## Operasyon
- Yeni backend endpoint yok.
- Local storage key migration yok.
- Telemetry yok.
- Rollback UI-safe.

## Sign-off
Release notu normal yanıt akışı ile regeneration akışını ayırır.
