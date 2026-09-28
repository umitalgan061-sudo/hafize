# Görev Dışa Aktarma Gizlilik

Görünen görevleri dışa aktarma yalnız açık kullanıcı eylemiyle çalışır.

Export server'a veri göndermez. JSON dosyası browser Blob üzerinden oluşturulur. İçerikte scheduleId, status, agentId, task, runAt ve maxAttempts bulunabilir; Authorization, credential veya token alanları eklenmez.

Bu nedenle export bir server backup yerine kullanıcının yerel görünüm kopyasıdır.
