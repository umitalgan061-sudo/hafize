# İstek Girişi Sınırı (Request Input Boundary)

## Sorun

Depodaki sınır fonksiyonlarının çoğu şu kalıpla yazılmıştır:

```js
async function read({ ownerId, operation, params } = {}) { … }
```

Buradaki `= {}` varsayılanı **yalnızca argüman `undefined` olduğunda** devreye
girer. Çağıran taraf `null`, bir dizi veya ilkel bir değer gönderdiğinde
JavaScript, doğrulama katmanına hiç girilmeden dilin kendi `TypeError`'ını
fırlatır:

```
TypeError: Cannot destructure property 'ownerId' of '…' as it is null.
```

Bu davranış üç nedenle sorunludur:

1. Modülün kendi `INVALID_*` sözleşmesi atlanır; çağıran taraf beklemediği bir
   hata tipiyle karşılaşır ve `catch` blokları yanlış dala girer.
2. `TypeError` mesajı iç değişken adlarını dışarı taşır.
3. `normalizeMemoryRetrieval` gibi "asla fırlatmaz, `{ ok: false }` döner"
   sözleşmesi veren fonksiyonlarda sözleşme tamamen bozulur.

## Kural

Dış çağrıdan istek nesnesi alan her sınır fonksiyonu, alanları ayrıştırmadan
önce girişi `lib/request-input.mjs` üzerinden normalize eder:

```js
import { normalizeRequestInput } from './request-input.mjs';

async function read(request) {
  const { ownerId, operation, params } = normalizeRequestInput(request, fail);
  …
}
```

- `undefined` → `{}` (çağıran hiç argüman vermemiştir; mevcut davranış korunur).
- Düz nesne → değiştirilmeden geçirilir.
- `null`, dizi, string, sayı, boolean → modülün kendi `fail(field)` fonksiyonu
  çağrılır ve `INVALID_<MODÜL>:request` biçiminde sözleşme hatası üretilir.

`fail` fırlatmayan bir uygulama olsa bile yardımcı, geçersiz girişin doğrulama
katmanına sızmasını `INVALID_REQUEST_INPUT:<field>` ile kesin olarak engeller.

Fabrika fonksiyonlarında alan adı `options`, `prepare(messages, options)` gibi
ikinci argümanlarda ise ilgili adı (`prepareOptions`) kullanılır.

## Kapsanan sınırlar

| Modül | Giriş noktası | Hata |
| --- | --- | --- |
| `lib/gmail-read-client.mjs` | `createGmailReadClient(options)`, `read(request)` | `INVALID_GMAIL_READ:*` |
| `lib/canva-read-client.mjs` | `createCanvaReadClient(options)`, `read(request)` | `INVALID_CANVA_READ:*` |
| `lib/memory-retrieval-boundary.mjs` | `normalizeMemoryRetrieval(request)` | `{ ok: false, error: 'INVALID_MEMORY_RETRIEVAL:request' }` |
| `lib/context-compaction.mjs` | `createContextCompactor(options)`, `prepare(messages, options)` | `INVALID_CONTEXT_COMPACTOR:*` |
| `lib/github-read.mjs` | `createGitHubReadFile(options)` | `GitHubReadError('INVALID_GITHUB_CONFIG', 500)` |
| `lib/gmail-read-tool-boundary.mjs` | fabrika + `execute(args, context)` | `INVALID_GMAIL_READ_TOOL:*` |
| `lib/canva-read-tool-boundary.mjs` | fabrika + `execute(args, context)` | `INVALID_CANVA_READ_TOOL:*` |
| `lib/gmail-send-tool-boundary.mjs` | fabrika + `execute(args, context)` | `INVALID_GMAIL_SEND_TOOL:*` |

Tool boundary katmanlarının **ilk** argümanı (`args`) zaten açık `typeof`
kontrolüyle doğrulanıyordu; düzeltilen nokta **ikinci** argümandır. Bu argüman
`principal` ve `gmail-send` için `approvalGranted` bayrağını taşıdığı için
geçersiz bir context'in dil hatasıyla düşmesi yerine sözleşme hatasıyla
kapanması güvenlik açısından önemlidir.

## Test

`scripts/test-request-input.mjs`:

- Yardımcının `undefined` / düz nesne / geçersiz giriş davranışını doğrular.
- Yukarıdaki her sınır için `null`, `[]`, `'text'`, `42` girişlerinin `TypeError`
  değil sözleşme hatası ürettiğini doğrular.
- Fırlatmayan `fail` uygulamasının geçersiz girişi sızdıramadığını doğrular.
- Geçerli akışın bozulmadığını (doğru isteğin hâlâ ağ çağrısına ulaştığını)
  doğrular.

Test `npm run check` kapısına dahildir.

## Geri alma

`lib/request-input.mjs` ve `scripts/test-request-input.mjs` silinip ilgili
modüllerdeki `normalizeRequestInput` çağrıları eski `{ … } = {}` imzalarına
döndürülür; `package.json` içindeki `check` girdileri geri alınır.
