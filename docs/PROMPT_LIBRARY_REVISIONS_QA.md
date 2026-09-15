# Revision History QA Plan

## Fonksiyonel kapsam

QA; snapshot üretimi, geçmiş listeleme, karşılaştırma, geri yükleme, tek kayıt silme, toplu geçmiş temizleme ve JSON export akışlarını kapsar.

## Snapshot senaryoları

Yeni prompt oluşturulduğunda boş history beklenir. Düzenleme butonuna basıldığında mevcut snapshot kaydedilir. Aynı içerik değiştirilmeden tekrar açıldığında duplicate snapshot üretilmez.

## Çoklu düzenleme

Aynı prompt art arda farklı içeriklerle düzenlendiğinde her benzersiz durum sırayla history listesine eklenir. 10 kayıt sınırından sonra en eski kayıt retention dışına çıkar.

## Restore

Seçilen revision restore edildiğinde ana prompt başlığı, body ve etiketleri revision değerlerine döner. Favori, kullanım sayısı ve createdAt korunur.

Restore öncesindeki mevcut sürüm manual revision olarak görünmelidir.

## Güvenlik

HTML/JS payload'ları yalnız textContent üzerinden gösterilir. Script etiketi, onclick attribute veya HTML string injection oluşmamalıdır.

## Storage

Geçersiz JSON boş history gibi ele alınır. Storage read/write hataları uygulamanın ana sohbetini durdurmamalıdır.

## Export

Export yalnız istemin history'sini içermelidir. Sürüm, source, promptId ve exportedAt alanları bulunmalıdır. Boyut sınırı aşılırsa bounded fallback uygulanmalıdır.

## Erişilebilirlik

Dialog role, aria-modal, labelledby ve status aria-live değerleri doğrulanır. Escape ile kapanma ve Tab focus trap kontrol edilir.

## PWA

Revision scripti shell cache asset listesinde bulunur. Yeni cache sürümü eski cache'leri temizleme davranışını bozmamalıdır.

## Regression

Mevcut Prompt Library CRUD, kullanım istatistikleri, smart-fill ve command palette davranışlarının revision modülü yüzünden değişmediği doğrulanır.

## Kabul kriteri

Kritik senaryoların tamamı başarılı olmadan feature merge edilmez.
