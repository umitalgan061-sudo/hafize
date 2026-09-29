# Koleksiyon Performans Notları

Koleksiyon sayısı 24 ile sınırlandırılır. Prompt sayısı mevcut library sınırına tabidir.

Sayım her render'da mevcut prompt listesi üzerinden türetilir; ayrı sayaç senkronizasyonu yapılmaz.

MutationObserver yalnızca prompt listesi ve koleksiyon panelindeki childList/subtree değişimlerini izler.

Select option sayısı koleksiyon limiti nedeniyle küçüktür.

Assignment map normalize edilirken bounded entry sayısı kullanılır.

Import dosyası parse edilmeden önce boyut kontrolünden geçer.

Export payload boyutunu kontrol eder; sınır aşılırsa assignment listesi bounded biçimde kısaltılır.

Koleksiyon silme bütün prompt içeriklerini yeniden serialize etmez; yalnızca map'ten hedef collection ID'sini çıkarır.

DOM render işlemlerinde replaceChildren kullanılır. Kullanıcı verisi için HTML parser kullanılmaz.

Klavye shortcut listener tek document listener'dır ve editable alanlarda erken döner.

PWA shell asset listesi statik olduğundan runtime network keşfi yapılmaz.

Performans regressyon testleri collection count, bounded import, bounded assignment ve observer davranışlarını source contract olarak kontrol eder.
