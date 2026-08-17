# SSE Server Backpressure Contract

## Amaç

Hafize streaming yanıtlarında Node HTTP response buffer'ının kontrolsüz büyümesini önlemek ve istemci bağlantısı kapandığında stream yazımını güvenli biçimde durdurmak.

Bu sözleşme özellikle model-provider `/api/chat` streaming yoluna uygulanır. `/api/agent/run` da aynı SSE davranışına taşınması gereken sunucu yolu olarak korunur; bu PR'ın doğrudan runtime entegrasyonu provider route'undadır.

## Backpressure davranışı

Node `response.write(chunk)` çağrısı `false` döndürürse yeni upstream chunk okunmadan önce `drain` beklenir. Böylece yavaş bir tarayıcı veya ağ bağlantısı karşısında uygulama sınırsız biçimde response buffer doldurmaz.

Bekleme sırasında şu olaylardan biri gerçekleşirse yazım fail-closed durur:

- response `close`,
- response `error`,
- ilgili `AbortSignal` abort,
- response'un destroyed/ended/finished hale gelmesi.

Listener'lar sonuç ne olursa olsun temizlenir. Aynı writer üzerinde drain beklenirken ikinci eşzamanlı write reddedilir.

## Bounded drain süresi

`drain` olayı hiçbir zaman gelmezse bir streaming request'in sonsuza kadar açık kalmaması gerekir. Bu nedenle drain beklemesi varsayılan **30 saniye** ile bounded'dır.

- yapılandırılabilir aralık **100 ms–120 saniye**,
- varsayılan değer `30_000 ms`,
- süre aşımı `SSE_OUTPUT_DRAIN_TIMEOUT` hatası üretir,
- timeout timer'ı `unref()` destekleniyorsa process yaşam döngüsünü tek başına açık tutmaz,
- drain/close/error/abort önce gerçekleşirse timeout temizlenir,
- timeout sonrasında drain/close/error listener'ları geride bırakılmaz.

Bu timeout bir provider retry mekanizması değildir. Aynı request yeniden gönderilmez ve model çıktısı tekrar üretilmez; yalnız sıkışmış outbound HTTP yazımı sonlandırılır.

## Chunk sınırı

Tek bir outbound chunk varsayılan olarak en fazla **256 KiB** olabilir. Bu sınır normal NVIDIA SSE token akışının çok üzerindedir ve yanlışlıkla büyük bir payload'ın tek write ile response buffer'a taşınmasına karşı ek koruma sağlar.

Aşım `SSE_OUTPUT_CHUNK_TOO_LARGE` ile fail-closed sonuçlanır. Sınır yalnız 1 KiB–1 MiB aralığında yapılandırılabilir.

## Disconnect davranışı

İstemci bağlantısı kapanırsa writer yeni veri veya hata frame'i yazmaz. Destroy edilmiş socket üzerinde `end()` çağrısını zorlamaz. Model-provider route'un mevcut AbortController'ı response `close` olayında upstream provider signal'ını da abort etmeye devam eder.

Bu davranış özellikle uzun NVIDIA NIM streaming yanıtlarında gereksiz provider tüketiminin ve write-after-end hatalarının azaltılması için önemlidir.

## Hata frame'i

Upstream async iterable gerçek bir hata ile kesilirse ve istemci hâlâ bağlıysa yalnız bounded ve sabit kodlu SSE hata frame'i yazılır:

`STREAM_INTERRUPTED`

İstemci zaten kapanmış veya signal abort edilmişse hata frame'i yazılmaz. Drain timeout sonrasında da route yeni bir provider isteği başlatmaz.

## Güvenlik sınırı

Bu katman:

- yeni network request üretmez,
- retry yapmaz,
- request body/header/AbortSignal yeniden yazmaz,
- authorization veya cookie okumaz,
- secret/credential değerine erişmez,
- localStorage/sessionStorage/IndexedDB/clipboard kullanmaz,
- shell, exec, spawn veya terminal yeteneği eklemez,
- agent/tool permission sözleşmesini değiştirmez.

Backend default-deny tool policy, external write/send/merge approval, shared trace/task ledger ve provider veri-akışı sınırları aynen korunur.

## Test / DoD

Regresyon testleri şu davranışları kilitler:

- `write(false)` sonrası `drain` bekleme,
- drain öncesi upstream iterator'ın ilerlememesi,
- close/error/abort sırasında beklemenin sonlanması,
- varsayılan 30 saniyelik drain timeout ve bounded 100 ms–120 saniye konfigürasyonu,
- timeout'un `SSE_OUTPUT_DRAIN_TIMEOUT` üretmesi,
- drain/abort timeout'tan önce gelirse timer/listener cleanup,
- listener cleanup,
- eşzamanlı write reddi,
- 256 KiB chunk sınırı ve UTF-8 byte hesabı,
- normal/event/error SSE frame üretimi,
- async iterable pipe sonucu ve byte/chunk sayaçları,
- `/api/chat` route'unda JSON yolunun etkilenmemesi,
- disconnect sonrası `STREAM_INTERRUPTED` yazılmaması,
- gerçek stream hatasında yalnız bağlı istemciye bounded hata frame'i gönderilmesi.

## Geri alma

Revert için `lib/sse-node-writer.mjs`, model-provider Node route entegrasyonu, ilgili testler ve bu sözleşme kaldırılır. Provider schema, agent registry, storage, PWA cache veya herhangi bir credential migrasyonu yoktur.
