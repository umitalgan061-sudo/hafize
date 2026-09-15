# Yerel Veri Merkezi — Ürün Sözleşmesi

## Amaç

Yerel Veri Merkezi, Hafize'nin tarayıcıda tuttuğu kullanıcı verilerini tek bir görünür yönetim yüzeyinde özetler ve kullanıcıya açık temizleme kontrolleri verir.

## Temel prensipler

- Yalnız açıkça tanımlı storage anahtarları yönetilir.
- Bilinmeyen `hafize.*` anahtarları silinmez.
- Veri sunucuya gönderilmez.
- Temizleme her zaman açık kullanıcı aksiyonu ister.
- Toplu temizleme geri alınamaz olarak kabul edilir.
- Boyut bilgisi ölçülür; içerik gereksiz yere ekrana dökülmez.

## Yönetilen alanlar

Sohbetler, taslaklar, istem kütüphanesi, istem filtre durumu, composer geçmişi, composer geçmiş ayarları, tema tercihi ve hareket tercihi yönetilen allowlist içindedir.

## Ölçüm

Her alan için mevcut/boş durumu, karakter sayısı, yaklaşık UTF-8 byte boyutu ve güvenli sayım özeti gösterilir. Storage timestamp bilgisi yoksa uydurma tarih üretilmez.

## Temizleme

Tek alan silme yalnız ilgili anahtarı kaldırır. Toplu temizleme yalnız allowlist alanlarını siler. Yeni feature'ların eklediği bilinmeyen anahtarlar otomatik olarak silinmez.

## Manifest

Manifest yalnız metadata taşır: sürüm, alan kimliği, label, mevcutluk, byte/karakter sayısı ve sayım özeti. Mesaj, prompt, draft veya history içerikleri manifest içine yazılmaz.

## PWA

UI assetleri shell cache policy'ye dahil edilir. `/api/*` yolları network-only kalır.

## UX

Panel Settings altında görünür, mevcut ayarları devralır ve failure-soft çalışır. Storage kullanılamıyorsa chat akışı etkilenmez.

## Geri alma

UI ve testler revert edildiğinde yönetilen storage kayıtları kullanıcı cihazında otomatik olarak silinmez; rollback uygulama kodu katmanında yapılır.
