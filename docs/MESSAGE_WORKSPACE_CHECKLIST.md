# Mesaj Çalışma Alanı Release Checklist

## Kaynak

- `public/message-workspace.js` yalnız client-side metadata yönetir.
- `public/message-workspace-policy.js` sınırları bağımsız test edilebilir hâle getirir.
- `public/message-workspace.css` masaüstü, mobil, reduced-motion ve forced-colors görünümlerini taşır.
- `public/index.html` policy → UI yükleme sırasını korur.

## Veri

- `hafize.message-workspace.v1` tek feature metadata anahtarıdır.
- Conversation storage'a migration yoktur.
- Bozuk storage güvenli boş varsayılanla karşılanır.
- Record sayısı 240'ı geçmez.
- Selection/export 100 kayıtla sınırlıdır.
- Note 600 karakterdir.
- Tag 24 karakter ve 8 adettir.

## UI

- Her mesajda save, feedback, note, tag ve menu eylemleri bulunur.
- Save ve feedback `aria-pressed` ile görünür durumu yansıtır.
- Panel status satırı canlıdır.
- Sonuçtan gerçek mesaja gitme çalışır.
- Sonuç yokken açıklayıcı empty state görünür.
- Mobile action alanı iki sütun düzenine düşer.
- Reduced-motion odak animasyonunu devre dışı bırakır.
- Forced-colors kontrast sınırlarını korur.

## Güvenlik

- `fetch` yok.
- `XMLHttpRequest` yok.
- `WebSocket` yok.
- Cookie veya Authorization erişimi yok.
- Conversation storage temizleme yetkisi yok.
- HTML string injection API'si yok.
- Export yalnız local Blob'dur.

## PWA

- CSS shell cache'tedir.
- Policy JS shell cache'tedir.
- UI JS shell cache'tedir.
- Cache revision `v23`'tür.
- `/api/*` network-only davranışında değişiklik yoktur.

## Test

- Policy sınır testi.
- Source contract testi.
- Adversarial testi.
- Compatibility testi.
- Keyboard testi.
- Runtime boundary testi.
- Export testi.
- Integration testi.
- Regression testi.
- Storage resilience testi.
- UX contract testi.
- Documentation coverage testi.

## Gözden geçirme

- Mevcut Conversation Workspace davranışı korunur.
- `app.js` conversation storage sahibi olarak kalır.
- Self-development branch `hafize/auto-*` biçimindedir.
- PR body değişiklik, neden, test ve rollback bilgilerini içerir.
- 3000 changed-line bütçesi aşılmaz.
- Güvenlik veya veri kaybı riski varsa quota ikinci plandadır.
