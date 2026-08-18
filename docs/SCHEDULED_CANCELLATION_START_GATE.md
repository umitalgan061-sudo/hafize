# Scheduled cancellation start gate

## Amaç

Zamanlanmış ajan çalışması iptal edildiğinde cancellation yalnız üst promise'i sonlandırmakla kalmamalı; iptal provider çağrısı başlamadan gelmişse alttaki NVIDIA completion hiç başlatılmamalıdır.

Bu sözleşme iki ayrı başlangıç yarışını kapatır:

1. `scheduled-agent-executor` içindeki abort listener kurulduktan sonra completion microtask'ı başlamadan gelen iptal.
2. `scheduled-nvidia-completion` bounded abort runtime'ı kurulduktan sonra gerçek provider callback'i çağrılmadan önce runtime signal'inin abort olması.

## Fail-closed davranış

- Caller signal zaten aborted ise provider callback'i çağrılmaz.
- Abort listener kurulduktan sonra fakat queued completion başlamadan signal abort olursa provider callback'i çağrılmaz.
- Bounded runtime signal'i provider başlangıcından önce aborted ise provider callback'i çağrılmaz.
- Caller cancellation, `SCHEDULE_AGENT_RUN_CANCELLED` olarak kalır.
- Bounded runtime timeout'u başlangıçtan önce tetiklenmişse `SCHEDULE_AGENT_RUN_TIMEOUT` cancellation'dan ayrılır.
- Timeout ve cancellation dışındaki provider hataları bu katmanda yeniden yorumlanmaz; mevcut üst redaction sözleşmesine bırakılır.

## Neden yalnız promise race yeterli değil?

Bir promise'in cancellation sonucu erken reject olması, iç callback'in hiç çalışmadığını garanti etmez. Özellikle callback bir microtask ile başlatılıyorsa şu sıra mümkündür:

1. wrapper abort listener'ı kurar;
2. completion callback'ini microtask kuyruğuna koyar;
3. caller signal abort olur ve dış promise reject edilir;
4. queued microtask yine çalışıp provider callback'ini başlatır.

Bu davranış kullanıcıya iptal edilmiş görünmesine rağmen gereksiz inference, network ve maliyet üretir. Başlangıç kapısı bu yüzden gerçek callback invocation noktasında yeniden signal kontrolü yapar.

## Güvenlik sınırı

Bu değişiklik yeni bir provider, endpoint veya retry mekanizması eklemez. NVIDIA NIM ana scheduled provider olarak kalır. Helper veya executor:

- API key okumaz;
- Authorization/cookie işlemez;
- storage veya memory yazmaz;
- shell/exec/spawn açmaz;
- tool permission genişletmez;
- external write/send/merge approval politikasını değiştirmez.

Agent registry dört profil olarak kalır ve tool policy backend tarafında default-deny olmaya devam eder.

## Test sözleşmesi

Regresyon testleri en az şu davranışları kilitler:

- executor microtask yarışında `providerCalls === 0`;
- runtime pre-abort durumunda `providerCalls === 0`;
- timeout runtime pre-abort durumunda timeout kodunun korunması;
- runtime dispose'un cancellation yolunda da exactly-once çağrılması;
- dört profilli roster ve default-deny policy'nin değişmemesi;
- secret, shell ve istemci storage yüzeylerinin bu katmana eklenmemesi.

## Geri alma

Revert için `scheduled-agent-executor` microtask başlangıç kontrolü, `scheduled-nvidia-completion` pre-start cancellation kontrolü ve bu turdaki ilgili test/sözleşme dosyaları kaldırılır. Kalıcı veri, schema veya token migrasyonu yoktur.
