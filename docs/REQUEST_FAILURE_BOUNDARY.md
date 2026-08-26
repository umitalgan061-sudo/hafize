# İstek Hatası Sınırı

## Sorun

`server.mjs` içindeki üst düzey istek işleyicisi tüm hataları tek bir `catch`
bloğunda `sendJson` ile yanıtlıyordu. `sendJson` önce `setSecurityHeaders(res)`
çağırır, yani `res.setHeader` kullanır.

`/api/agent/run` akış modunda araç çağrılarından **önce** SSE başlıklarını
gönderir (`startSse`), çünkü araç etkinliği (`hafize-tool-activity`) canlı
yayınlanır. Bu noktadan sonra oluşan herhangi bir hata — araç defterinin
reddettiği bir sonuç, kopan sokete yazma, beklenmeyen bir çalışma zamanı
hatası — üst düzey `catch` bloğuna düşüyor ve orada `res.setHeader`
`ERR_HTTP_HEADERS_SENT` fırlatıyordu.

Bu ikinci hata `async` işleyicinin içinde oluştuğu için hiçbir yerde
yakalanmıyordu. Node 22 varsayılanı (`--unhandled-rejections=throw`) altında
sonuç, **tüm sunucu sürecinin düşmesiydi**: tek bir bozuk akış diğer tüm
oturumları da kapatıyordu.

## Sözleşme

`lib/request-failure.mjs` iki adımı ayırır.

`classifyRequestFailure(error)` → `{ silent, status, body }`

| Hata | Durum | Gövde |
| --- | --- | --- |
| `AbortError`, `ECONNRESET`, `EPIPE`, `ERR_STREAM_*` | — | `silent: true` (istemci gitti) |
| `BODY_TOO_LARGE` | 413 | `{ error: 'BODY_TOO_LARGE' }` |
| `NVIDIA_NOT_CONFIGURED` | 503 | `{ error: 'NVIDIA_NOT_CONFIGURED' }` |
| `NVIDIA_CHAT_ERROR` | `error.status` (400–599) veya 502 | `{ error, detail }` — detay 1200 karaktere kırpılır |
| `INVALID_NVIDIA_RESPONSE` | `error.status` veya 502 | `{ error: 'INVALID_NVIDIA_RESPONSE' }` |
| `SyntaxError` | 400 | `{ error: 'INVALID_JSON' }` |
| diğer | 500 | `{ error: 'INTERNAL_ERROR' }` |

Bilinmeyen hatalarda `error.message` **hiçbir zaman** yanıta konmaz; yol,
kimlik veya yığın izi taşıyabilir.

`deliverRequestFailure(res, error, { sendJson })` sınıflandırmayı yanıtın
gerçek durumuna göre teslim eder ve seçtiği yolu döndürür:

- `'closed'` — yanıt bitmiş/yok edilmiş: hiçbir şey yazılmaz.
- `'aborted'` — istemci koptu: açık akış sessizce kapatılır.
- `'json'` — başlıklar henüz gönderilmemiş: normal JSON hata yanıtı.
- `'stream'` — akış başlamış: durum kodu değiştirilemez, bunun yerine
  `data: {"error":"..."}` çerçevesi yazılır ve akış kapatılır. İstemci
  (`public/app.js`) bu alanı zaten okuyup hatayı kullanıcıya gösterir.

Teslim yolu kendi içinde hata alırsa (sokete yazılamıyorsa) yalnızca bağlantıyı
kapatır ve `'closed'` döner. **Hata sınırı asla fırlatmaz** — fırlatması ilk
sorunu yeniden yaratırdı.

## Doğrulama

`scripts/test-request-failure.mjs`:

- her sınıflandırma dalını, durum kodu sınırlamasını ve detay kırpmayı,
- iç hata metninin sızmadığını,
- dört teslim yolunu ve `res.write` fırlattığında bile sınırın sessiz kaldığını,
- gerçek bir `node:http` sunucusunda akış ortasında fırlatan işleyicinin
  yakalanmamış promise reddi üretmediğini ve sunucunun sonraki isteği hâlâ
  yanıtladığını doğrular.

## Geri alma

`server.mjs` içindeki tek `deliverRequestFailure(...)` çağrısı eski `if/else`
zincirine döndürülebilir; modül başka hiçbir yerden import edilmez, bu yüzden
`lib/request-failure.mjs` ve testi silinebilir.
