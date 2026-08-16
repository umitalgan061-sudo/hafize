# Schedule Create UI Contract

## Amaç

Hafize kullanıcısının mevcut cloud-session kimliğiyle, uygulama içinden açık bir form gönderimiyle yeni zamanlanmış görev oluşturmasını sağlar. Bu katman yeni bir backend yetkisi icat etmez; mevcut `POST /api/schedules` ve `schedule-command-boundary` sözleşmesini kullanır.

## Açık kullanıcı eylemi

Görev yalnız kullanıcı `＋ Görev` kontrolünü açıp formu doldurduktan ve `Görev oluştur` düğmesine bastıktan sonra oluşturulur. Mount, agent/model seçimi, session değişimi veya başka DOM olayı otomatik POST üretmez.

## İstemci şeması

Gönderilebilen alanlar yalnız şunlardır:

- `agentId`: mevcut `#agentSelect` option allowlist'inde exact bulunan kimlik, en fazla 120 karakter.
- `task`: boş olmayan düz metin, en fazla 4000 karakter.
- `runAt`: `datetime-local` girdisinden üretilen ISO tarih-saat; UI geçmiş zamanı reddeder.
- `maxAttempts`: 1–5 arasında tamsayı.

`retryDelayMs`, `traceId`, `ownerId`, tool policy, token veya başka server alanları istemci tarafından üretilmez.

## Kimlik ve secret sınırı

İstek `credentials: same-origin` kullanır. JavaScript cloud-session cookie değerini, signing key'i, bearer schedule tokenını veya password hash'i okumaz. HttpOnly session doğrulaması server-side yapılır. 401 durumunda yalnız tekrar güvenli cloud oturumu açılması gerektiği gösterilir.

## Ajan sınırı

UI ajan registry'sinin bağımsız bir kopyasını tutmaz. Mevcut, server kaynaklı `#agentSelect` seçeneklerinden seçim üretir. Backend yine `schedule-command-boundary` içinde registry exact-match doğrulaması yapar. Bu yüzden istemci manipülasyonu yeni ajan veya yetki açamaz.

## Tool ve dış etki sınırı

Bir görevin oluşturulması o görevin gelecekte kullanabileceği tool yetkilerini genişletmez. Agent/tool izinleri provider'dan bağımsız backend default-deny kalır. Gelecekteki görev GitHub, Gmail, Canva veya başka dış sistemde write/send/merge isterse ilgili mevcut approval boundary ayrıca uygulanır.

## Kalıcılık

Form taslağı localStorage, sessionStorage, IndexedDB veya cookie'ye yazılmaz. Başarılı create sonrasında form temizlenir. Task metni yeni bir client-side persistent store'a kopyalanmaz.

## Hata davranışı

- `400`: alanlar server boundary tarafından reddedildi.
- `401`: cloud session gerekli.
- `503`: schedule kapasitesi dolu.
- diğer HTTP/network hataları: genel, sanitize edilmiş hata mesajı.

Ham server exception, trace veya secret ayrıntısı UI'ya taşınmaz.

## Geri alma

Revert için `schedule-create.js`, CSS/style loader, testler, bu sözleşme ve shell loader/cache wiring kaldırılır. Schedule API, store, worker, lease veya kayıtlı görev şemasında migrasyon yoktur.
