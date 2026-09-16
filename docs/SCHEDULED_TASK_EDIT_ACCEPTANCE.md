# Schedule Edit Acceptance

- Planlandı görevde Düzenle görünür.
- Form mevcut ajan, task, zaman ve maxAttempts değerlerini gösterir.
- Geçmiş zaman kaydedilemez.
- Credential içeren task kaydedilemez.
- Başkasının görevi güncellenemez.
- Running/completed/failed/cancelled görev güncellenemez.
- Başarılı edit scheduleId, traceId, ownerId ve attempts değerlerini korur.
- Quick postpone yalnız runAt değiştirir.
- Repeat-plan yeni schedule oluşturur.
- Bulk selection 40 kayıtla sınırlıdır.
- Bulk işlemler tamamlandıktan sonra seçim temizlenir.
- API PATCH 200, invalid 400, ownership 404, non-editable 409 döndürür.
- API responses cache'lenmez.
