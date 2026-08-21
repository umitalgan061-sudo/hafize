# Voice input transcript session boundary

Hafize'nin tek-seferlik sesli giriş düğmesi tarayıcının `SpeechRecognition` / `webkitSpeechRecognition` API'sini kullanır. Bu belge, interim/final transcript parçalarının composer'a nasıl taşındığını ve oturum kapandıktan sonra hangi callback'lerin artık güvenilir kabul edilmediğini tanımlar.

## Amaç

Ses tanıma sağlayıcısı `interimResults = true` ile aynı konuşmayı birden çok `result` olayı halinde güncelleyebilir. `event.resultIndex`, bütün cümlenin başlangıcı değil, önceki event'e göre değişen en düşük sonuç indeksidir. Bu nedenle yalnız `resultIndex` sonrasındaki metni ilk composer prefix'iyle birleştirmek daha önce finalleşmiş kelimeleri silebilir.

Hafize artık her recognition instance için ayrı bir transcript session tutar:

- composer'ın recognition başlamadan önceki değeri immutable `prefix` olarak alınır;
- browser result indeksleri session içindeki segment tablosuna uygulanır;
- daha önce finalleşmiş segmentler `resultIndex` ilerlediğinde korunur;
- interim segment yalnız aynı indeks için yeni browser sonucu geldikçe değiştirilir;
- browser sonuç dizisi kısalırsa artık mevcut olmayan stale tail segmentleri atılır;
- boş/malformed transcript composer'ı silmez;
- bütün segmentler normalize edildikten sonra mevcut `input.maxLength` sınırı uygulanır;
- transcript yalnız composer'a yazılır; otomatik mesaj gönderimi yapılmaz.

## Oturum izolasyonu

Transcript segmentleri global veya konuşmalar arası state değildir. Her `SpeechRecognition` instance başlatıldığında yeni session oluşturulur. Recognition doğal olarak bittiğinde, başlatma başarısız olduğunda, kullanıcı stop/abort yaptığında veya controller destroy edildiğinde session referansı bırakılır.

Kullanıcı stop ya da visibility-triggered abort yaptığında aktif recognition instance controller sahipliğinden **hemen** çıkarılır. Bunun iki nedeni vardır:

1. tarayıcı `stop()` / `abort()` çağrısından sonra gecikmiş `onresult`, `onerror` veya `onend` callback'i gönderebilir;
2. kullanıcı yeni bir sesli giriş oturumunu eski browser `onend` callback'ini beklemeden başlatabilmelidir.

Released recognition instance'ın callback'leri `recognition !== current` kontrolü nedeniyle composer, toast veya listening state üzerinde artık değişiklik yapamaz.

## State event sözleşmesi

`hafize:voice-input-state` yalnız `{ source: "voice-input", listening: boolean }` taşır. Stop/abort `listening:false` durumunu browser `onend` callback'ini beklemeden yayınlar. Bu davranış voice-output barge-in ve hands-free orkestrasyonunun mikrofonun artık aktif olmadığını deterministik görmesini sağlar.

Stale `onend` ikinci bir `false` state eventi üretemez.

## Veri ve gizlilik sınırı

- Ham ses Hafize backend'ine bu modül tarafından yüklenmez.
- Tarayıcının konuşma tanıma sağlayıcısı sesi işleyebilir; UI bunu kullanıcıya bildirir.
- Transcript session yalnız sayfa belleğinde, ilgili recognition instance süresince bulunur.
- Session kalıcı belleğe, connector context'ine veya agent prompt'una otomatik yazılmaz.
- Secret/credential değerleri bu akışa dahil edilmez.
- Sesli giriş metni otomatik gönderilmez; kullanıcı composer üzerindeki normal gönderme kontrolünü kullanır.

## Regresyon beklentileri

Testler en az şu durumları kilitler:

- `resultIndex` 0'dan 1/2'ye ilerlerken final segmentlerin korunması;
- final + interim + yeni interim kombinasyonlarının doğru sıralanması;
- result array küçülmesinde stale interim tail'in kaldırılması;
- malformed/blank sonuçların composer'ı bozmaması;
- mevcut composer prefix'i ve max-length sınırının korunması;
- yeni recognition oturumunun önceki oturum transcript state'ini miras almaması;
- stop/abort sonrası late `onresult` ve `onerror` callback'lerinin inert kalması;
- stale `onend` callback'inin yeni oturum veya state event'lerini bozmaması;
- destroy sonrası recognition callback'lerinin inert kalması.
