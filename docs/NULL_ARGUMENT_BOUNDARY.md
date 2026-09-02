# Null argüman sınırı

Bu belge, Hafize'nin istek anındaki (request-time) güven sınırlarının `null` argümana nasıl cevap verdiğini tanımlar.

## Sorun

JavaScript'te `function read({ ownerId } = {})` biçimindeki varsayılan değer yalnızca `undefined` için devreye girer. Çağrı `read(null)` ise varsayılan uygulanmaz ve fonksiyon ham bir `TypeError` fırlatır:

```
TypeError: Cannot destructure property 'ownerId' of '(intermediate value)' as it is null.
```

Bu davranış üç nedenle sorunludur:

1. **Sözleşme kaçağı.** Çağıran kod ve tool runtime `INVALID_*`, `AUTH_REQUIRED`, `GMAIL_*`, `CANVA_*` gibi belgelenmiş hata kodlarına göre karar verir. `TypeError` bu kümenin dışındadır ve `catch` bloklarında beklenmedik dala düşer.
2. **Gözlemlenebilirlik kaybı.** `TypeError` mesajı hangi alanın reddedildiğini değil, yalnızca destructuring'in başarısız olduğunu söyler.
3. **Default-deny beklentisi.** Connector ve schedule sınırları reddi kendi doğrulamalarıyla üretmelidir; ham bir runtime hatası bu sınırın çalıştığının kanıtı değildir.

## Kural

İstek anında çağrılan her sınır giriş noktası argümanı parametre listesinde değil, gövdenin ilk satırında `?? {}` ile çözer:

```js
async function read(request) {
  const { ownerId, operation, params } = request ?? {};
  const owner = text(ownerId, 'ownerId', { max: 128 });
  ...
}
```

Böylece `null`, `undefined` ve eksik argüman aynı yolu izler ve modülün kendi doğrulaması reddi üretir.

## Kapsam

Kural, girdisi bir güven sınırını geçen istek anındaki giriş noktaları için zorunludur:

| Modül | Giriş noktası | `null` cevabı |
| --- | --- | --- |
| `lib/gmail-read-client.mjs` | `read` | `INVALID_GMAIL_READ:ownerId` |
| `lib/canva-read-client.mjs` | `read` | `INVALID_CANVA_READ:ownerId` |
| `lib/gmail-read-tool-boundary.mjs` | `execute` (options) | `INVALID_GMAIL_READ_TOOL:owner` |
| `lib/canva-read-tool-boundary.mjs` | `execute` (options) | `INVALID_CANVA_READ_TOOL:owner` |
| `lib/gmail-send-tool-boundary.mjs` | `execute` (options) | `GMAIL_SEND_APPROVAL_REQUIRED` |
| `lib/gmail-send-contract.mjs` | `normalizeGmailSendRequest` (options) | `GMAIL_SEND_APPROVAL_REQUIRED` |
| `lib/server-auth.mjs` | `authenticate` | `{ ok: false, error: 'AUTH_REQUIRED' }` |
| `lib/memory-retrieval-boundary.mjs` | `normalizeMemoryRetrieval` | `{ ok: false, error: 'INVALID_MEMORY_RETRIEVAL:ownerId' }` |
| `lib/schedule-http-api.mjs` | `handle` | `{ matched: false }` |
| `lib/schedule-command-boundary.mjs` | `create` / `list` / `cancel` | `{ ok: false, error: 'AUTH_REQUIRED' }` |
| `lib/model-provider-router.mjs` | `complete` | `INVALID_PROVIDER_PAYLOAD` |
| `lib/oauth-token-file-store.mjs` | `save` / `load` / `remove` | `INVALID_OAUTH_TOKEN_STORE:ownerId` |
| `lib/canva-token-refresh.mjs` | `refresh` | `INVALID_CANVA_TOKEN_REFRESH:ownerId` |
| `lib/canva-token-revoke.mjs` | `revoke` | `INVALID_CANVA_TOKEN_REVOKE:ownerId` |
| `lib/canva-token-exchange.mjs` | `exchange` | `INVALID_CANVA_TOKEN_EXCHANGE:ownerId` |
| `lib/google-token-exchange.mjs` | `exchange` | `INVALID_GOOGLE_TOKEN_EXCHANGE:ownerId` |
| `lib/gmail-agent-runtime.mjs` | `requestContext` / `connectionStatus` | kimliksiz boş bağlam |
| `lib/canva-agent-runtime.mjs` | `requestContext` / `connectionStatus` | kimliksiz boş bağlam |

Önemli bir alt kural: `gmail_send` yolunda `null` options bag'i **onay verilmiş** olarak okunmaz. `approvalGranted` varsayılanı `false` kalır ve çağrı `GMAIL_SEND_APPROVAL_REQUIRED` ile reddedilir.

## Kapsam dışı

Uygulama başlangıcında bir kez çağrılan `create*()` fabrikaları bu kuralın dışındadır. Oradaki `null`, çalışma anında dış girdiden gelmeyen bir wiring hatasıdır ve süreç başlarken zaten gürültülü biçimde başarısız olur.

## Doğrulama

`scripts/test-null-argument-boundary.mjs` yukarıdaki tablodaki her giriş noktasını `null` ile çağırır ve şunları doğrular:

- hiçbir çağrı `TypeError` sızdırmaz;
- fırlatılan hata mesajı belgelenmiş kod önekleriyle eşleşir;
- sonuç nesnesi döndüren sınırlar sözleşmedeki reddi üretir;
- `gmail_send` onay kapısı `null` options ile açılmaz.

Test `npm run check` kapısına bağlıdır.

## Geri alma

Değişiklik modül başına iki satırlık yerel bir düzenlemedir. Geri almak için ilgili fonksiyonun imzası eski `({ ... } = {})` biçimine döndürülür ve `scripts/test-null-argument-boundary.mjs` ile `package.json` içindeki `check` girdisi kaldırılır.
