# Zamanlanmış Görev Tekrarları

## Amaç
Tek seferlik zamanlamayı bozmadan aynı görevi günlük, haftalık veya aylık aralıklarla yeniden çalıştırmak.

## Veri sözleşmesi
Tekrar alanı isteğe bağlıdır. Alan yoksa veya null ise kayıt tek seferlik kabul edilir.
Tekrar nesnesi `frequency`, `interval` ve frekansa göre `daysOfWeek` veya `dayOfMonth` içerir.

## Frekanslar
- daily: gün aralığı 1–30.
- weekly: hafta aralığı 1–30 ve en az bir gün.
- monthly: ay aralığı 1–30 ve ay günü 1–31.

## Çalışma davranışı
Çalışma claim edildiğinde tek seferlik ve tekrarlı kayıt aynı worker yolundan geçer.
Başarılı tamamlanmada tekrarlı kayıt yeni oluşuma planlanır.
Son denemesi başarısız olan tekrarlı kayıt da bir sonraki oluşuma planlanır.
Geçici retry, mevcut maxAttempts semantiğini korur.

## Geçmiş
Her oluşum güvenli bir özet olarak son 20 kayıt içinde tutulur.
Görev çıktısı, prompt tam içeriği veya credential geçmişe yazılmaz.
Hata alanı yalnız kontrollü hata kodu olarak saklanır.

## İptal
scheduled durumundaki kayıt iptal edildiğinde yeni oluşum yaratılmaz.
Daha önceki geçmiş korunur.
running kayıt için mevcut cancel kısıtı korunur.

## Geriye dönük uyumluluk
Schema version artırılmadan optional alanlar kullanılır.
Eski snapshot'larda bulunmayan alanlar null/0/boş dizi varsayılanlarıyla normalize edilir.
Eski tek-seferlik kayıtların runAt ve status davranışı değişmez.

## Sınırlar
Store kapasitesi 128 kayıt olarak korunur.
Bir kaydın geçmişi 20 oluşumla sınırlıdır.
Bir istekte yalnız güvenli recurrence alanları kabul edilir.

## DoD
Normalize testleri, tarih matematiği, worker geçişleri, persistence round-trip,
HTTP validation ve browser UI doğrulandıktan sonra özellik sürümlenir.
