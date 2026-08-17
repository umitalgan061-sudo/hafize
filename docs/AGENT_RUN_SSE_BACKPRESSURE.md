# Agent Run SSE Backpressure Boundary

## Amaç

`POST /api/agent/run` araç kullanan ajan yanıtlarında aynı bağlantı üzerinden iki tür veri üretir: güvenli tool-activity event'leri ve NVIDIA NIM'in ikinci completion SSE akışı. Bu sınır, yavaş veya kapanmış bir istemciye veri yazarken Node response buffer'ını kontrolsüz büyütmemeyi ve bağlantı koptuktan sonra yeni agent/tool işi başlatmamayı amaçlar.

## Ortak writer

Agent SSE yolu `lib/sse-node-writer.mjs` içindeki ortak writer'ı `lib/agent-sse-node-session.mjs` üzerinden kullanır. Böylece `/api/chat` provider streaming ile aynı temel kurallar geçerlidir:

- `response.write()` `false` dönerse sonraki chunk okunmadan önce `drain` beklenir.
- Tek outbound chunk varsayılan olarak en fazla 256 KiB'dir.
- `drain` sonsuza kadar beklenmez; ortak writer'ın bounded timeout politikası kullanılır.
- response kapanmışsa veya request AbortSignal tetiklenmişse yeni yazım yapılmaz.
- writer yalnız mevcut response'u kullanır; yeni network isteği veya retry üretmez.

## Agent akışı

SSE oturumu yalnız istemci `Accept: text/event-stream` istediğinde oluşturulur ve ilk gerçek SSE yazımına kadar lazy kalır. JSON agent yanıtlarının davranışı değiştirilmez.

Tool çağrılı akışta sıra şöyledir:

1. Tool başlamadan hemen önce public `hafize-tool-activity` event'i awaited olarak yazılır.
2. Bu yazım artık mümkün değilse request controller abort edilir, ledger `client_stream_closed` ile kapanır ve tool çalıştırılmaz.
3. Tool tamamlandıktan sonraki public activity event'i de awaited yazılır.
4. Sonraki tool'a ancak bu event başarıyla yazılabildiyse geçilir.
5. İkinci NVIDIA completion body yalnız session writer'ın `pipe()` yolu ile tüketilir.

Bu davranış özellikle bir client disconnect sonrasında listedeki sonraki read tool'un gereksiz yere çalıştırılmasını önler. External write/send/merge tool izinleri değişmez ve `approvalGranted: false` korunur.

## Hata görünürlüğü

Upstream NVIDIA bağlantısı streaming başladıktan sonra kesilirse istemciye yalnız sabit `STREAM_INTERRUPTED` kodu gösterilebilir. Ham exception mesajı, provider body, token, header veya credential SSE'ye kopyalanmaz.

İkinci completion HTTP hata cevabı body olarak kullanıcıya taşınmaz; mümkünse upstream body cancel edilir ve yalnız `NVIDIA_CHAT_ERROR` public kodu yazılır. İstemci zaten kapalıysa yeni hata frame'i yazılmaya çalışılmaz.

Writer kaynaklı backpressure/close/timeout/oversize hataları ikinci bir yazım döngüsü başlatmaz. Bu hatalar bağlantının güvenli biçimde kapanması için terminal kabul edilir.

## Synthetic SSE cevapları

Skill'in doğrudan tamamladığı veya ilk NVIDIA completion'ın tool çağırmadan metin döndürdüğü yollar da aynı session katmanını kullanır. Bunlar mevcut frontend sözleşmesini korumak için bir `choices[].delta.content` frame'i ve ardından `[DONE]` üretir. Mesaj otomatik olarak başka endpoint'e yeniden gönderilmez.

## Güvenlik sınırı

Bu değişiklik:

- agent registry veya selector/specialist sayısını değiştirmez,
- NVIDIA/local provider tool policy'sini değiştirmez,
- yeni tool veya connector yetkisi açmaz,
- GitHub/Gmail/Canva write/send/merge onaylarını etkilemez,
- secret, cookie veya Authorization değerlerini SSE payload'ına sokmaz,
- `shell=True`, `exec`, `spawn`, terminal veya komut yürütme eklemez,
- storage, memory veya credential davranışını değiştirmez.

## Geri alma

Revert için `agent-sse-node-session.mjs`, ilgili testler ve bu belge kaldırılır; `server.mjs` içindeki `/api/agent/run` SSE çağrıları önceki doğrudan `res.write()` yoluna döndürülür. Kalıcı veri veya schema migrasyonu yoktur.
