# Response retry contract

## Ürün amacı

Hafize, son yapay zekâ yanıtı bekleneni karşılamadığında kullanıcının aynı son isteği yeniden çalıştırabilmesini sağlar. Bu davranış konuşma geçmişini sessizce değiştirmez ve mevcut composer/agent/model/tool güvenlik yolunu atlamaz.

## Davranış sözleşmesi

- `Tekrar dene` yalnız son render edilmiş mesaj bir assistant yanıtıysa ve hemen öncesinde geçerli bir user mesajı varsa görünür.
- Aktif streaming sırasında retry eylemi gösterilmez ve programatik `submitPrompt` çağrısı da fail-closed döner.
- Son kullanıcı metni en fazla mevcut composer sınırı olan 12.000 karakter olabilir.
- Composer içinde anlamlı bir gönderilmemiş taslak varsa retry bu taslağı asla overwrite etmez; durum mesajı gösterir ve odağı composer'a taşır.
- Retry, eski user veya assistant mesajını silmez/değiştirmez. Son user isteğini yeni bir user turn olarak yeniden gönderir; böylece önceki yanıt karşılaştırma ve denetim için geçmişte kalır.
- Gönderim doğrudan yeni bir fetch çağrısı oluşturmaz. Mevcut `#composer` submit yolu kullanılır.

## Neden mevcut submit yolu zorunlu?

Composer submit yolu zaten aktif model, seçili ajan, toolsEnabled durumu, local-provider tool guard, chat run cancellation controller ve SSE tüketimini bir arada uygular. Retry enhancement bu politikaların paralel bir kopyasını üretmez. Böylece ileride ana submit politikasında yapılacak güvenlik düzeltmeleri retry için de otomatik geçerli kalır.

## Güvenlik ve mahremiyet

- Yeni endpoint, connector veya dış servis çağrısı yoktur.
- localStorage, sessionStorage, cookie veya clipboard kullanılmaz.
- Prompt yalnız mevcut DOM'daki son user mesajından okunur ve tekrar composer'a verilir; ayrı bir kalıcı kopya tutulmaz.
- Secret, credential, bearer token, trace veya task-ledger bilgisi okunmaz.
- External write/send/merge onay sınırları değişmez.
- Provider seçimi veya retry eylemi ajan tool yetkisini genişletmez.

## Yarış ve lifecycle güvenliği

Message listesi uygulama render'larında yeniden kurulduğu için retry eylemi MutationObserver ile yeniden bağlanır. Enhancement kendi eklediği action node'u tekrar gözlemlediğinde sonsuz render döngüsü oluşturmamak için aynı assistant/prompt çifti üzerinde mevcut action korunur. `destroy()` observer'ı disconnect eder, input listener'ını kaldırır, action/status node'larını temizler.

## Erişilebilirlik

- Retry button gerçek `button` öğesidir ve açıklayıcı `aria-label` taşır.
- Taslak engeli ve retry durumu polite `role=status` alanında duyurulur.
- Mobilde minimum dokunma yüksekliği artırılır.
- `focus-visible`, `prefers-reduced-motion` ve `forced-colors` davranışları ayrı CSS kurallarıyla korunur.

## Regresyon kanıtı

- `scripts/test-response-retry.mjs` — pure helper + DOM lifecycle + draft/stream guard.
- `scripts/test-response-retry-integration.mjs` — loader, PWA cache, style wiring, normal composer submit sözleşmesi ve forbidden side-effect API guard'ları.
- `scripts/test-response-retry-style.mjs` — mobil dokunma alanı, focus, reduced-motion ve forced-colors kaynak sözleşmesi.

## Geri alma

Bu özellik bağımsız enhancement olarak tasarlanmıştır. Loader satırları, PWA shell asset'leri, `response-retry.*` dosyaları, testler ve bu belge revert edilirse temel sohbet gönderme/streaming davranışı değişmeden kalır.
