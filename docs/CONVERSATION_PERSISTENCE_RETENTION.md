# Conversation persistence retention contract

## Amaç

`hafize.conversations.v1` yalnız yerel sohbet geçmişi için kullanılır. Bu sözleşme, sohbet geçmişinin hem yükleme hem de aynı sayfadaki sonraki `localStorage.setItem` yazımlarında aynı bounded ve allowlist tabanlı biçimde tutulmasını tanımlar.

## Canonical sınırlar

- En fazla 30 sohbet.
- Sohbet başına en fazla 200 geçerli mesaj.
- Mesaj başına en fazla 12.000 Unicode karakter.
- Başlık en fazla 80 karakter.
- Conversation/message kimliği en fazla 120 karakter ve dar ASCII allowlist kullanır.
- Yalnız `user` ve `assistant` mesaj rolleri kalıcı geçmişe girebilir.
- Assistant tool activity en fazla 4 kayıt, label başına en fazla 80 karakterdir.
- `ownerId`, `traceId`, token, credential ve şema dışı gelecekteki alanlar canonical storage'a taşınmaz.

## Retention yönü

Mesaj dizisi kronolojik olarak eski → yeni tutulur. Limit aşımında **en yeni 200 geçerli mesaj korunur**. Eski implementasyondaki ilk 200 kaydı koruma davranışı yeni bağlamı kaybettirebildiği için geçersizdir.

Normalization sondan başa ilerler. Duplicate message ID varsa en yeni geçerli örnek korunur. Sonuç yeniden kronolojik sıraya çevrilir. Bu seçim, uzun bir konuşmanın en güncel kullanıcı talebi ve Hafize yanıtlarını korur.

## Bootstrap sırası

`conversation-storage-guard.js` `index.html` içinde `app.js` dosyasından önce `defer` ile yüklenir ve DOM beklemeden install edilir. Guard DOM okumaz; bu nedenle localStorage sanitization için `DOMContentLoaded` beklemek gerekli değildir.

Bu sıra iki nedenle zorunludur:

1. Mevcut storage kirli veya eski biçimdeyse `app.js` ilk `loadConversations()` çağrısından önce canonical değer yazılmış olur.
2. Guard aynı sayfadaki sonraki persistence yazımlarını sınırlandıracak write boundary'yi app başlamadan kurar.

`ui-shell.js` geriye uyumlu enhancement loader'ını korur; direct script aynı `hafizeConversationStorageGuardScript` id'sini taşıdığı için shell ikinci kez asset eklemez.

## Write boundary

Guard yalnız `hafize.conversations.v1` anahtarını intercept eder. Başka localStorage anahtarları orijinal `setItem` davranışına aynen gider.

Conversation anahtarına yapılan her yazım önce `sanitizeStoredValue` üzerinden geçer. Böylece uygulama belleğinde geçici olarak limit üstü veri oluşsa bile persistent snapshot canonical sınırlara göre kaydedilir. Invalid JSON persistence girişimi `[]` olarak fail-closed normalize edilir.

Boundary install idempotent olmalıdır. Aynı script veya shell enhancement tekrar install çağırırsa ikinci wrapper katmanı oluşturulmaz.

## Reload davranışı

Sayfa ilk açılışında mevcut storage değiştirildiyse guard bir kez best-effort reload isteyebilir. İçeriksiz session marker reload döngüsünü engeller. Normal aynı-sayfa persistence yazımları reload tetiklemez; yalnız bounded canonical snapshot yazılır.

Reload başarısız olsa bile sanitized storage yazılmış kalır. Storage erişimi veya boundary kurulumu desteklenmiyorsa sistem yeni network/remote persistence fallback'i açmaz.

## Güvenlik özellikleri

- HTML parsing veya `innerHTML` yoktur; kullanıcı metni veri olarak kalır.
- `system`, `developer` ve `tool` rolü storage üzerinden model request bağlamına enjekte edilemez.
- Prototype üzerinden miras kalan zorunlu alanlar kabul edilmez.
- Bilinmeyen alanlar deny-list ile değil explicit output şemasıyla dışarıda bırakılır.
- Cookie, OAuth tokenı, connector credential veya cloud secret okunmaz.
- Yeni API endpoint veya network isteği yoktur.
- Agent/tool permission sözleşmesi değişmez.

## PWA

`conversation-storage-guard.js` shell asset olmaya devam eder. Cache sürümü v90'dır. `/api/*` cevapları service worker tarafından network-only kalır; conversation storage hiçbir backend response cache'iyle birleştirilmez.

## Test sözleşmesi

Regresyonlar en az şunları doğrular:

- 215 mesajdan en yeni 200'ün korunması.
- Duplicate ID durumunda en yeni kaydın tutulması.
- Malformed tail kayıtlarının retention sayımını bozmaması.
- Aynı sayfadaki `setItem` yazımının 200 mesaj sınırına düşürülmesi.
- Conversation/message canary secret alanlarının persist edilmemesi.
- Başka storage anahtarlarının değiştirilmemesi.
- Write boundary'nin idempotent kurulması.
- Guard scriptinin `app.js` önünde yüklenmesi.
- PWA v90 ve `/api/*` network-only davranışının korunması.

## Geri alma

Bu değişiklik geri alınacaksa `conversation-storage-guard.js` write boundary ve newest-retention mantığı kaldırılır, direct bootstrap script satırı kaldırılır ve PWA cache önceki sürüme döndürülür. Backend veya durable schema migrasyonu olmadığı için server-side rollback gerektirmez.
