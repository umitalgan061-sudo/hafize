# Markdown görüntüleme tercihi

## Varsayılan

Markdown biçimlendirmesi varsayılan olarak açıktır.

Tercih yalnız mevcut tarayıcı profilinde yerel olarak tutulur.

Storage anahtarı `hafize.markdown-rendering.v1`'dir.

## Kapatma

Composer yardım satırındaki `Biçimlendirme açık` düğmesine basıldığında renderer görünümü kapanır.

Assistant yanıtları güvenli düz metin olarak yeniden gösterilir.

## Açma

Aynı kontrol `Biçimlendirme kapalı` olarak görünür.

Tekrar basıldığında mevcut assistant içerikleri Markdown renderer ile çizilir.

## Veri

Tercih conversation history ile aynı storage alanında değildir.

Tercihin değeri yalnız `on` veya `off` olarak saklanır.

## Fallback

Preference scripti yüklenmezse renderer varsayılan olarak açık davranır.

Renderer scripti yüklenmezse ana uygulamanın plain-text davranışı korunur.

## Erişilebilirlik

Kontrol gerçek button'dır.

`aria-pressed` güncellenir.

`aria-label` durum değişimine göre güncellenir.

`:focus-visible` görünür odak çerçevesi korunur.

## PWA

Tercih kodu shell cache'e dahil edilir.

Yerel tercih service worker cache'ine yazılmaz.

## Gizlilik

Aç/kapat işlemi network çağrısı başlatmaz.

Telemetry veya analytics event'i gönderilmez.

## Sorun giderme

Kontrol görünmüyorsa composer history help bileşeninin yüklenmesini ve script asset durumunu kontrol et.

Preference kapatıldıktan sonra biçimli DOM kaybolmuyorsa `hafize:markdown-rendering-preference` event listener'ını kontrol et.

## Rollback

Preference scripti geri alınsa bile mevcut renderer varsayılan açık görünür.

Kalıcı storage kaydı silinmek zorunda değildir.
