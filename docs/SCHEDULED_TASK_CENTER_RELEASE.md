# Schedule Center Release

## Özellikler

- Güvenli görev planlama Preview
- Tekrar planla
- Yerel görev şablonları ve yedekleme
- Altı başlangıç şablonu
- Yerel taslak
- Hızlı zaman seçimi
- Arama, sıralama ve filtre temizleme
- Durum özeti
- Geçici Preview activity
- Görev ayrıntıları
- Görünen görev dışa aktarma

## Release kontrolleri

Syntax ve ilgili schedule testleri çalıştırılır. Index ve service worker asset listeleri birlikte kontrol edilir.

Preview'ın ilk submitte POST yapmadığı, onay sonrası mevcut typed handlerın çalıştığı ve duplicate/template/draft yardımcılarının doğrudan network isteği yapmadığı doğrulanır.

## Gizlilik

Yerel taslak, template ve preview activity açık kullanıcı eylemi sınırında tutulur. Schedule API yanıtları service worker cache'lenmez.

## Rollback

Yeni JS/CSS assetleri index ve shell cache listesinden kaldırılabilir. Backend schedule endpointleri değiştirilmez.
