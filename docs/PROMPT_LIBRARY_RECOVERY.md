# Prompt Library recovery backup

## İçerik
Recovery yedeği prompt, collection ve revision alanlarını aynı JSON dosyasında toplar.

## Kullanım
Yedek yalnızca diagnostics panelindeki Yedek indir eylemiyle kullanıcı tarafından başlatılır.

## Boyut
Recovery JSON yaklaşık 1.5 MB üzerinde ise dosya oluşturulmaz; kullanıcıya durum bildirilir.

## Amaç
Repair öncesi ve problem incelemesi sırasında taşınabilir yerel kanıt üretmektir.

## Gizlilik
Dosyada prompt metinleri bulunabilir. Dosyanın saklanması, paylaşılması ve tekrar içe alınması kullanıcı sorumluluğundadır.

## Sunucu
Recovery backup hiçbir backend endpoint'ine gönderilmez.

## Geri yükleme
Recovery biçimi teşhis/inceleme amaçlıdır; ana import preview ile geri yüklenebilir prompt verisi gerektiğinde yalnızca items alanı kullanılmalıdır.
