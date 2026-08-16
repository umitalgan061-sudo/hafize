# Uzun yanıt katlama sözleşmesi

`public/response-fold.js`, yalnız tamamlanmış ve uzun Hafize yanıtlarını daha rahat okunabilir hale getiren istemci tarafı bir görünüm iyileştirmesidir.

## Davranış

- Yalnız `.message.assistant` mesajları değerlendirilir; kullanıcı mesajları katlanmaz.
- Normalize edilmiş düz metni en az 1800 karakter olan yanıtlar varsayılan olarak dar görünür.
- Kullanıcı görünür `Devamını göster` düğmesiyle yanıtın tamamını açabilir ve `Daralt` ile yeniden kısaltabilir.
- Katlama yalnız CSS max-height/overflow sınıflarını değiştirir; mesaj metni kesilmez, yeniden yazılmaz veya silinmez.
- Kontrol `aria-expanded` ve `aria-controls` ile içerik durumunu erişilebilir biçimde bildirir.

## Streaming sınırı

Aktif streaming sırasında en son assistant mesajı katlanmaz. Controller hem mesaj mutasyonlarını hem de gönder düğmesinin streaming sınıfını izler. Streaming tamamlandığında uzun yanıt yeniden değerlendirilir ve ancak o zaman katlanabilir hale gelir. Böylece kullanıcı akan metni izlerken görünüm aniden daralmaz.

## Veri ve güvenlik sınırı

Bu özellik yalnız render edilmiş assistant `.content` metninin uzunluğunu okur.

- network isteği yapmaz;
- `/api/*` endpoint çağırmaz;
- localStorage/sessionStorage/cookie kullanmaz;
- clipboard kullanmaz;
- form submit veya tool çağrısı yapmaz;
- mesaj ID, trace, agent metadata veya başka sohbet verisi okumaz;
- içerik için `innerHTML` kullanmaz.

Katlama tercihi kalıcı değildir. Yeni render veya oturumda uzun yanıt varsayılan dar durumdan başlar.

## Lifecycle

Controller idempotent mount kullanır. Mesaj kısalırsa eklenen kontrol ve CSS sınıfları temizlenir. `destroy()` MutationObserver'ı kapatır, controller'ın eklediği kontrolleri kaldırır ve içerik sınıflarını eski haline getirir.

## Mobil ve erişilebilirlik

Dar ekranlarda katlı yükseklik daha küçük tutulur ve dokunma hedefi büyütülür. Focus-visible görünümü vardır. Hareket geçişleri `prefers-reduced-motion` tercihini bozmaz.

## PWA

`/response-fold.js` same-origin shell asset'tir ve shell cache sürümü v38'e yükseltilir. `/api/*` istekleri network-only kalır.

## Geri alma

Controller, loader kaydı, PWA asset satırı, testler ve bu belge kaldırıldığında mevcut mesaj render, Markdown, kopyalama, arama ve dışa aktarma davranışları değişmeden kalır.
