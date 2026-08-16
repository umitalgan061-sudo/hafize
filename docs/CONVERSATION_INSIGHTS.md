# Aktif sohbet istatistikleri

`public/conversation-insights.js`, yalnız ekranda render edilmiş aktif sohbet mesajlarından küçük ve yerel istatistikler üretir.

## Gösterilen bilgiler

- Kullanıcı mesajı sayısı.
- Hafize mesajı sayısı.
- Toplam görünür kelime sayısı.
- Toplam görünür karakter sayısı.
- 220 kelime/dakika sabit varsayımıyla yaklaşık okuma süresi.

Kart boş konuşmada gizlidir. Mesajlar eklendiğinde veya streaming sırasında görünür metin değiştiğinde `MutationObserver` ile yeniden hesaplanır.

## Veri sınırı

Hesap yalnız `#messages` içindeki `.message.user .content` ve `.message.assistant .content` düz metnine dayanır. Tool activity, trace, message ID, agent metadata, başka sohbet geçmişi veya backend verisi hesaplamaya girmez.

Bu özellik:

- `fetch`, XHR, WebSocket veya `sendBeacon` çağırmaz,
- localStorage/sessionStorage/cookie kullanmaz,
- clipboard veya form submit çağrısı yapmaz,
- tool/connector/agent permission üretmez,
- metni başka bir event payload'ına taşımaz.

İstatistikler yalnız DOM'dan her render sırasında türetilir; ayrı bir kalıcı kopya tutulmaz.

## Erişilebilirlik

Kart normal `utility-card` yapısını kullanır. Özet metni `role="status"`, `aria-live="polite"` ve `aria-atomic="true"` ile güncellenir. Boş konuşmada kart gizlendiği için gereksiz ekran okuyucu gürültüsü oluşmaz.

## Yaşam döngüsü

Controller mevcut bir `#conversationInsightsCard` varsa onu yeniden kullanır; yoksa kendisi üretir. Kendi ürettiği kartı `destroy()` sırasında kaldırır ve observer'ı disconnect eder. Önceden var olan bir kartı destroy sırasında silmez.

## PWA ve geri alma

JS/CSS shell asset listesinde yer alır. Değişiklik geri alındığında yalnız sohbet bilgisi kartı, ilgili test/belge ve shell cache sürüm ilerlemesi kaldırılır; mesaj içeriği ve sohbet davranışı değişmez.
