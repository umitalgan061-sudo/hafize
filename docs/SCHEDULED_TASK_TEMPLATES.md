# Kayıtlı Görev Şablonları

Zamanlanmış Görevler paneline cihaz üzerinde çalışan küçük bir şablon koleksiyonu eklendi.

## Kaydetme

Görev formunda ajan, görev metni ve deneme sayısını doldurduktan sonra yeni şablon adını yazıp Mevcut görevi kaydet seçilir. Bu işlem açık kullanıcı eylemidir.

## Uygulama

Kayıtlı şablondan biri seçilip Uygula denildiğinde yalnız form alanları doldurulur. Çalıştırma zamanı yeniden ayarlanmazsa workspace kendi varsayılan zamanını kullanır. Görev formu otomatik gönderilmez; planlama önizlemesi yine gerekir.

## Sınırlar

En fazla 12 şablon tutulur. Şablon adı 60, görev metni 5000 karakterdir. Ajan ID'si ve 1–5 deneme sayısı normalize edilir. Aynı ad ikinci kez kaydedilmez.

## Gizlilik

Şablonlar hafize.scheduled-task-templates.v1 localStorage anahtarında saklanır. Sunucuya gönderilmez, telemetry kullanılmaz ve service worker API yanıtı cachelemez.

## Silme

Sil düğmesi açık onay ister. Silinen şablon mevcut schedule kayıtlarını etkilemez.
