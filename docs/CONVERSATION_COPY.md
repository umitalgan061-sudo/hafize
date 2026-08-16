# Conversation copy sözleşmesi

`conversation-copy.js`, aktif konuşmadaki görünür kullanıcı/Hafize mesajlarını açık kullanıcı tıklamasıyla düz metin olarak clipboard'a kopyalar.

## Veri sınırı

- Yalnız `#messages .message .content` düz metni okunur.
- Tool activity, trace, message id, agent metadata, localStorage veya başka konuşmalar okunmaz.
- Transcript en fazla 512 KiB olabilir; sınır aşılırsa kopyalama fail-closed durur.
- Clipboard yalnız secure context ve `navigator.clipboard.writeText` mevcutsa kullanılır.
- Network, cookie, storage, otomatik submit veya tool çağrısı yoktur.

## Kullanıcı kontrolü

Kopyalama yalnız görünür `Sohbeti kopyala` düğmesinin kullanıcı tarafından tetiklenmesiyle başlar. Boş konuşmada düğme gizlidir. Başarı/hata durumu kısa süre düğme üzerinde gösterilir.

## PWA

Controller same-origin shell asset olarak cache'lenir. `/api/*` istekleri service worker'da network-only kalmaya devam eder.
