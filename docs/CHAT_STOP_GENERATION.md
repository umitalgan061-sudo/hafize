# Sohbet yanıtını durdurma sözleşmesi

Hafize aktif bir sohbet yanıtını kullanıcı tarafından görünür biçimde durdurabilir. Bu davranış yalnız istemci UX özelliği değildir; aynı run'a ait ağ isteğinin de iptal edilmesini sağlayan dar bir yaşam döngüsü sınırıdır.

## Yaşam döngüsü

1. Kullanıcı mesaj gönderdiğinde `chat-run-controller` yeni bir `AbortController` ve opak run token üretir.
2. Aynı anda yalnız bir aktif run olabilir. İkinci `begin()` çağrısı fail-closed reddedilir.
3. `/api/chat` veya `/api/agent/run` isteği exact aktif run'ın `AbortSignal` değerini taşır.
4. Aktif yanıtta gönder düğmesi görünür `Yanıtı durdur` kontrolüne dönüşür.
5. Kullanıcı durdurduğunda yalnız aktif run abort edilir; yeni veya eski generation token'ları birbirinin lifecycle'ını kapatamaz.
6. Run tamamlandığında exact token ile `finish()` çağrılır ve composer normal gönderme durumuna döner.

## Kısmi yanıt davranışı

SSE üzerinden daha önce alınmış metin abort anında silinmez. Üretilmiş bölüm yerel sohbet geçmişine kaydedilir. Henüz tek bir metin delta'sı bile gelmediyse kullanıcıya `Yanıt durduruldu.` kaydı gösterilir.

Kullanıcı abort'u provider hatası değildir. Bu nedenle abort, `NVIDIA yanıtı alınamadı` hata yoluna düşmez ve upstream hata ayrıntısı gibi sunulmaz.

## Composer davranışı

Aktif run sırasında mesaj kutusu yazılabilir kalır; kullanıcı sonraki isteğini hazırlayabilir. Ancak mevcut `isStreaming` sınırı ikinci mesaj gönderimini, ajan değiştirmeyi, tool mode değiştirmeyi, sohbet değiştirmeyi ve geçmiş silmeyi run bitene kadar engellemeye devam eder.

Bu özellik tool permission sözleşmesini değiştirmez. Abort yeni bir tool, external write, send veya merge yetkisi üretmez ve backend default-deny modeli aynen korunur.

## Güvenlik ve gizlilik

- Run controller credential, owner ID, API key veya Authorization header işlemez.
- Abort state browser storage veya cookie'ye yazılmaz.
- Run token yalnız process-memory nesne kimliğidir; ağ isteğine veya model bağlamına gönderilmez.
- Yeni ajan eklenmez; mevcut dört profilli selector/specialist mimarisi korunur.
- PWA shell yalnız statik controller JS/CSS dosyalarını cache'ler; `/api/*` istekleri network-only kalır.

## Regresyon gereksinimleri

Canonical test suite şu davranışları kilitler: tek aktif run, idempotent abort, stale-token izolasyonu, plain-chat ve tool-chat fetch signal wiring'i, kısmi yanıtın korunması, abort'un genel NVIDIA hata eşlemesinden önce ele alınması ve yeni shell assetlerinin PWA cache listesinde bulunması.
