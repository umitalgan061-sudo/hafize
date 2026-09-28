# Yanıt Eylemleri Erişilebilirlik

## Kontroller
- Her eylem gerçek button elementidir.
- Her eylem aria-label ile isimlendirilir.
- Feedback state aria-pressed ile bildirilir.
- Streaming sırasında eylemler disabled olur.
- Yeniden üretilemeyen eski mesajda disabled durumu ve açıklayıcı title bulunur.

## Klavye
Tab sırası içerikten sonra eylemlere geçer. Enter ile buton çalışır. Yeni global browser kısayolu eklenmez.

## Görsel durum
Disabled kontroller tamamen görünmez hale getirilmez. Focus-visible outline korunur.

## Ekran okuyucu
Yanıt işlem grubu açıklayıcı aria-label taşır. Feedback toggle state semantik olarak okunabilir.

## Hareket
Yeni animasyon eklenmez. Reduced-motion davranışı korunur.

## Küçük ekran
Eylem butonları wrap olur ve yatay taşma üretmez.

## Kabul
- keyboard-only smoke
- screen-reader label smoke
- forced-colors smoke
- zoom/wrap smoke
