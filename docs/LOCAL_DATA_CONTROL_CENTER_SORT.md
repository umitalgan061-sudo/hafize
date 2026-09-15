# Yerel Veri Sıralama

Kontrol merkezi alanlarını registry sırasına ek olarak boyut, ada ve sağlık durumuna göre sıralamak mümkündür.

## Boyut

En büyük ve en küçük seçenekleri mevcut bounded byte metadatasını kullanır. Raw storage tekrar okunmaz.

## Ada göre

Sıralama Türkçe locale ile label üzerinden yapılır.

## Duruma göre

Integrity audit tarafından üretilen `empty`, `valid`, `invalid`, `truncated` ve `unavailable` state'leri dikkate alınır.

## Güvenlik

Sıralama yalnız DOM düzenini değiştirir. Storage mutation veya network call üretmez.

## Lifecycle

Data listesi yeniden çizildiğinde MutationObserver sıralamayı tekrar uygular. Destroy sonrasında observer kaldırılır.

## Mobile

Select control dar ekranlarda tek kolon olur.
