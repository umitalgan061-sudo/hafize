# Conversation organize lifecycle boundary

`public/conversation-organize.js`, sohbet listesindeki sabitleme ve kullanıcı başlığı metadata'sını yöneten istemci katmanıdır. Bu belge controller'ın yaşam döngüsü, storage yazımı ve host-owned DOM sınırını tanımlar.

## Tek controller sahipliği

Aynı `#conversationList` yüzeyini aynı anda yalnız bir organize controller yönetebilir. Ownership process-local `WeakSet` ile tutulur. İkinci kurulum fail-closed döner; mevcut controller'ın DOM'u dışarıdan değiştirilmiş olsa bile başka controller sessizce sahipliği devralmaz.

`destroy()` veya başarısız installation rollback ownership'i serbest bırakır. Böylece temiz bir remount mümkündür.

## Storage write sınırı

Organize katmanı canonical sohbet gövdelerini yazmaz. Kalıcı yazımı yalnız `hafize.conversation-organize.v1` metadata anahtarıyla sınırlıdır. `hafize.conversations.v1` yalnız bounded kaynak snapshot olarak okunur.

Bir metadata mutation yalnız controller canlı ve list ownership'i hâlâ kendisindeyse persistence'a ulaşabilir. Destroy edilmiş controller'ın eski click, editor, storage veya deferred-render callback'leri storage'a yazamaz.

Session mutation replay mevcut optimistic cross-tab reconciliation davranışını korur ve en fazla 30 kayıtla sınırlıdır.

## Host-owned DOM durumu

Controller bir conversation row'u ilk kez değiştirmeden önce şu host durumunu snapshot eder:

- organize dataset alanının varlığı ve değeri,
- `conversation-pinned` ve `organize-editing` class durumu,
- `.conversation-open` metni ve `title` attribute'u,
- `.conversation-delete` `aria-label` attribute'u.

Teardown veya installation rollback sırasında bu durum exact restore edilir. Controller yalnız kendi oluşturduğu `.conversation-organize-actions` ve editor yüzeylerini kaldırır. Önceden var olan organize action yüzeyi foreign/host-owned kabul edilir ve devralınmaz.

Controller'ın oluşturduğu stylesheet teardown'da kaldırılır. Host tarafından önceden sağlanan stylesheet korunur.

## Listener ve deferred-work sınırı

Controller tarafından oluşturulan row/editor listener'ları merkezi cleanup kaydında tutulur. MutationObserver ve storage listener kurulumu installation transaction'ının parçasıdır. Kurulum yarıda kalırsa eklenen listener, observer, owned DOM/style ve ownership geri alınır.

Mutation/storage kaynaklı render talepleri tek pending RAF veya timer'a coalesce edilir. Destroy sırasında pending handle iptal edilir. Bir callback iptalden sonra yine çağrılırsa canlı ownership'i yeniden doğrular ve inert kalır.

## Fail-closed davranış

Aşağıdaki durumlarda yeni mutation başlatılmaz:

- controller destroy edilmişse,
- list ownership kaybedilmişse,
- conversation id/title doğrulaması başarısızsa,
- source snapshot'ta hedef conversation yoksa,
- metadata persistence başarısızsa.

Invalid başlık önceki metadata'yı silmez. Persistence doğrulanmadan mutation ledger ilerletilmez.

## Capability sınırı

Conversation organize istemci katmanı:

- network isteği başlatmaz,
- clipboard okumaz/yazmaz,
- composer submit etmez,
- memory veya agent tool çağrısı yapmaz,
- external send veya repository merge yetkisi taşımaz.

Bu controller yalnız yerel sohbet-listesi sunumu ve bounded organize metadata'sını yönetir. Backend default-deny tool authorization ile agent/connector izin sözleşmelerinden bağımsız kalır.

## DoD

Değişiklik tamamlanmış sayılmak için en az şu regresyonların korunması gerekir:

1. duplicate controller install fail-closed,
2. destroy sonrası stale click storage'a yazamaz,
3. host row ve foreign action durumu teardown'da korunur,
4. observer/listener installation failure atomik rollback yapar,
5. pending deferred render destroy'da iptal edilir,
6. clean remount ownership'i yeniden alabilir,
7. PWA shell cache değişen client modülünü yeni versiyonla taşır.
