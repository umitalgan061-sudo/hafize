# Zamanlanmış Görevler Güvenlik Modeli

## Tenant izolasyonu

Her kullanıcı görevinin `ownerId` alanı store içinde tutulur. Public schedule payload bu alanı döndürmez. Listeleme, istatistik ve bulk cancel işlemleri authenticated principal subject üzerinden scope edilir.

## Yetki

Schedule oluşturmak uygulama oturumu gerektirir. Scheduled task olması ajana yeni tool yetkisi veya connector izni vermez. Execution mevcut agent registry ve approval katmanından geçmeye devam eder.

## Secret koruması

Command boundary task metninde plaintext credential biçimlerini reddeder. Secret'lar schedule storage'a yazılmamalıdır. Bir secret'a ihtiyaç duyan ajan işlemi server-side secret store ve mevcut connector izinleri üzerinden çözülmelidir.

## Input limits

Görev metni 20.000 karakterle, query 160 karakterle, cursor 1024 karakterle sınırlıdır. Bulk id listesi 100 elemanla sınırlıdır. Bunlar görev adedi sınırı değildir; request maliyetini ve kötüye kullanım alanını sınırlar.

## Cursor güvenliği

Cursor istemcinin üretmediği opaque bir değerdir. Decode işlemi JSON doğrulaması ve sort kontrolü yapar. Geçersiz veya farklı sort'a ait cursor kabul edilmez.

## Error hygiene

Provider hatalarının ham exception mesajları HTTP istemcisine verilmez. API standardize edilmiş hata kodları döndürür ve request id mevcutsa correlation header'ı taşır.

## PWA

Service worker `/api/` isteklerini network-only sınıfında bırakır. Schedule task metinleri service worker shell cache'e yazılmaz. Yalnız statik scheduler JavaScript ve CSS dosyaları cache edilir.

## Durable encryption

Yeni durable snapshots AES-256-GCM ile şifrelenir ve gzip ile küçültülür. Dosya 0600 permission ile yazılır. Encryption key runtime environment üzerinden alınır ve config/runtime katmanında kopyalar temizlenir.

## Bulk operasyonlar

Toplu iptal yalnız aynı owner'a ait scheduled kayıtları etkiler. Başka owner kayıtlarının存在 olması response'ta açıklanmaz; bu, kullanıcılar arası id probing riskini azaltır.

## Incident response

Schedule task içinde yanlışlıkla token bulunduğuna dair şüphe oluşursa task'ı iptal etmek tek başına yeterli değildir. İlgili secret rotate edilir, audit/log kayıtları incelenir ve gerekiyorsa durable snapshot restore edilir.
