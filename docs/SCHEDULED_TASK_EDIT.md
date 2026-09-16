# Zamanlanmış görev düzenleme

## Amaç
Planlanmış bir görevin çalıştırma zamanı, ajanı, metni veya maksimum deneme sayısı kullanıcı tarafından yeniden düzenlenebilir.

## Kapsam
Düzenleme yalnız `scheduled` durumundaki, oturum sahibine ait kayıtlar için geçerlidir.
Çalışan, tamamlanan, başarısız veya iptal edilen kayıtlar düzenlenmez.

## Akış
1. Görev panelini aç.
2. `Planlandı` durumundaki görevde `Düzenle` seç.
3. Mevcut ajan, metin, zaman ve deneme değeri forma taşınır.
4. Form değişiklikleri doğrulanır.
5. `PATCH /api/schedules/:id` gönderilir.
6. Başarılı yanıt sonrası liste yenilenir.

## Güvenlik
Görev kimliği URL içinde `encodeURIComponent` ile taşınır. Sunucu sahiplik kontrolünü tekrar yapar; istemci tarafı sahiplik güvenlik sınırı değildir.

Görev metninde düz metin credential bulunursa güncelleme reddedilir. Backend mevcut credential politikasını yeniden kullanır.

## Sınırlar
Görev metni 20.000 karakteri geçemez. Maksimum deneme 1–5 arasındadır. Yeni çalıştırma zamanı geçmişte olamaz. Mevcut deneme sayısından küçük maksimum deneme seçilemez.

## UI
Düzenleme iptal edilebilir. İptal, görevin sunucu tarafındaki değerlerini değiştirmez ve formu yeni görev moduna döndürür.

## PWA
Düzenleme kodu mevcut shell asset'i olarak servis worker cache kapsamındadır. `/api/schedules` yanıtları cache'lenmez.
