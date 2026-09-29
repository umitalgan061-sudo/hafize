# Koleksiyon Go / No-Go

## GO koşulları

Collection module doğru asset sırasıyla yüklenir.

Collection CSS shell'e dahildir.

Collection keyboard module shell'e dahildir.

Storage anahtarları bounded ve ayrı tutulur.

Stale assignments prune edilir.

Default collection yalnız yeni prompt ID'lerine uygulanır.

Tekli assignment çalışır.

Bulk assignment çalışır.

Collection filter doğru satır görünürlüğü uygular.

Collection delete prompt içeriğini silmez.

Import 500 KB üzerinde durdurulur.

Export object URL revoke eder.

Dynamic user text textContent ile yazılır.

Network API eklenmemiştir.

Keyboard shortcut editable alanlarda devralınmaz.

MutationObserver lifecycle'da disconnect edilir.

README feature ve test keşfini belirtir.

Changed lines 3000'i geçmez.

PR base main ve head auto branch olmalıdır.

## NO-GO koşulları

Bozuk JSON mevcut collection state'i siliyorsa release durdurulur.

Stale map prompt verisini etkiliyorsa release durdurulur.

Collection silme promptları siliyorsa release durdurulur.

Network telemetry eklenmişse release durdurulur.

Security sink görülüyorsa release durdurulur.

PWA asset eksikse release durdurulur.

Merge base güncellenmiş main ile uyumsuzsa release durdurulur.

## Kanıt

GitHub compare ölçümü release evidence'tır.

Kaynak contract testleri davranışın kritik sınırlarını doğrular.

Tam yerel test sonucu yoksa bu durum PR açıklamasında açıkça belirtilmelidir.

## Rollback

PR revert edilir.

Prompt Library ana storage anahtarı korunur.

Collection metadata kullanımı devre dışı kalabilir.

Kullanıcı prompt içeriğini kaybetmemelidir.
