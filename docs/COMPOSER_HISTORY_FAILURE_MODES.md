# Composer History — Hata Modları

## Bozuk JSON

Storage değeri parse edilemezse empty history kullanılır.

Uygulama boot akışı durmaz.

## Storage quota

`setItem` exception verirse history kalıcılaşmayabilir.

Composer submit yine çalışmalıdır.

Kullanıcı history'nin cihazda saklanamadığını görebilir; bu ana chat akışını engellemez.

## Dosya import hatası

512 KB üstü dosya kabul edilmez.

JSON parse hatası kullanıcıya bounded hata olarak bildirilir.

Import başarısız olduğunda mevcut history değiştirilmez.

## Eksik controller

Panel controller yoksa panel görünür ama history eylemleri güvenli biçimde no-op olur.

Bu durum script yükleme sırası hatasında crash üretmemelidir.

## Eksik composer

Core ve panel mount olmamalıdır.

Global API exposure mevcut olabilir fakat DOM mutation yapılmaz.

## Bozuk settings

Unknown `maxItems` default 40'a düşer.

`enabled:false` dışında enabled değerleri güvenli varsayılanla ele alınır.

0 retention explicit olarak history'yi kapatır.

## Navigation boundary

History boşsa arrow shortcut preventDefault yapmamalıdır.

Cursor listenin sonuna geldiğinde draft geri yüklenir.

İmleç orta konumdayken arrow history devreye girmez.

IME composition sırasında key event değiştirilmez.

## Export

Export URL geçici object URL'dir.

URL revoke edilir.

Dosya adı sabittir; kullanıcı metni dosya adına girmez.

## Security fallback

HTML parse veya script execution yoktur.

Untrusted history sadece string olarak composer'a yazılır.
