# Model ve Ajan Tercihleri Hızlı Referans

| Konu | Değer |
|---|---|
| Storage | hafize.model-preferences.v1 |
| Profil üst sınırı | 6 |
| Profil adı | 48 karakter |
| Model kimliği | 180 karakter |
| Ajan kimliği | 140 karakter |
| Import | 200 KB |
| Export | 200 KB |
| Kısayol | Ctrl / ⌘ + Shift + M |
| Kapatma | Escape |
| Senkronizasyon | localStorage storage event |
| Network | Yeni endpoint yok |
| Telemetry | Yok |
| Apply | Mesaj göndermez |
| PWA cache | v45 |
| PWA asset | model-preferences.css |

## Ana dosyalar

State: public/typed/model-preferences.ts
UI: public/typed/model-preferences-ui.ts
Entegrasyon: public/typed/app-shell.ts
Stil: public/model-preferences.css

## Ana testler

Typed unit:
public/typed/model-preferences.test.ts

Source gates:
scripts/test-model-preferences-contract.mjs
scripts/test-model-preferences-security.mjs
scripts/test-model-preferences-accessibility.mjs
scripts/test-model-preferences-pwa.mjs
scripts/test-model-preferences-import-preview.mjs
scripts/test-model-preferences-final-gate.mjs

## Operasyon

Sorun halinde önce JSON export alınır.
Storage hatası chat akışını durdurmamalıdır.
Profil uygulaması kullanıcı mesajı göndermez.
Import mevcut veriyi onay öncesinde değiştirmez.
