# Sınır giriş sözleşmesi (boundary input contract)

Bu belge Hafize'deki bağlayıcı (connector), araç (tool) ve komut sınırlarının geçersiz
giriş aldığında nasıl davranması gerektiğini tanımlar.

## Sorun

JavaScript'te `async function read({ ownerId } = {}) { ... }` biçimindeki varsayılan
destructuring **yalnız `undefined`** için çalışır. Çağıran `null`, dizi veya ilkel bir
değer verdiğinde fonksiyon gövdesi hiç çalışmaz ve motor ham bir `TypeError` fırlatır:

```
TypeError: Cannot destructure property 'ownerId' of '(intermediate value)' as it is null.
```

Bu davranışın üç somut sonucu vardır:

1. Modülün kendi hata kodu sözleşmesi (`INVALID_GMAIL_READ:*` gibi) atlanır; çağıran
   katman hatayı sınıflandıramaz ve genel `TOOL_EXECUTION_FAILED` gibi bilgisiz bir
   koda düşer.
2. Hata mesajı sözleşmenin değil motorun ürettiği bir iç metindir; sınır dışına
   sızdığında ayıklanması zorlaşır.
3. Sonuç nesnesi döndüren sınırlarda (`{ ok: false, error }`) çağıran hiç hata
   beklemediği için istisna daha yukarı kaçar.

## Kural

Kullanıcı, model veya HTTP katmanından veri alan her sınır giriş noktası, geçersiz
girişi **kendi hata sözleşmesine** çevirmek zorundadır. Ham `TypeError` bir sözleşme
yanıtı değildir.

Bunun için `lib/boundary-input.mjs` iki yardımcı sunar:

- `requireRecordInput(value, onInvalid, field = 'input')` — istisna fırlatan sınırlar
  için. `undefined` girişte donmuş boş nesne döndürür (alan bazlı doğrulama devam
  eder), geçerli nesneyi olduğu gibi geçirir, diğer her durumda modülün kendi
  hatasını fırlatır. `onInvalid` hatayı döndürebilir veya fırlatabilir.
- `optionalRecordInput(value)` — hata yerine `{ ok: false, error }` döndüren sınırlar
  için. Geçerli girişi, aksi hâlde `null` döndürür; çağıran kendi hata kodunu seçer.

`undefined` girişin boş nesne sayılması bilinçlidir: eksik argüman, mevcut alan bazlı
doğrulamaya (`INVALID_...:ownerId` gibi) düşmeye devam eder ve davranış değişmez.

## Kapsam

Sözleşmeye bağlanan giriş noktaları:

| Modül | Giriş noktası | Geçersiz giriş kodu |
| --- | --- | --- |
| `gmail-read-client` | `read` | `INVALID_GMAIL_READ:input` |
| `canva-read-client` | `read` | `INVALID_CANVA_READ:input` |
| `gmail-read-tool-boundary` | `execute` (options) | `INVALID_GMAIL_READ_TOOL:options` |
| `canva-read-tool-boundary` | `execute` (options) | `INVALID_CANVA_READ_TOOL:options` |
| `gmail-send-tool-boundary` | `execute` (options) | `INVALID_GMAIL_SEND_TOOL:options` |
| `google-token-exchange` | `exchange` | `INVALID_GOOGLE_TOKEN_EXCHANGE:input` |
| `canva-token-exchange` | `exchange` | `INVALID_CANVA_TOKEN_EXCHANGE:input` |
| `canva-token-refresh` | `refresh` | `INVALID_CANVA_TOKEN_REFRESH:input` |
| `canva-token-revoke` | `revoke` | `INVALID_CANVA_TOKEN_REVOKE:input` |
| `context-compaction` | `prepare` (options) | `INVALID_CONTEXT_COMPACTOR:options` |
| `memory-retrieval-boundary` | `normalizeMemoryRetrieval` | `{ ok: false, error: 'INVALID_MEMORY_RETRIEVAL:input' }` |
| `schedule-command-boundary` | `create` / `list` / `cancel` | `{ ok: false, error: 'INVALID_SCHEDULE_COMMAND' }` |

Yetki, onay ve sahiplik kontrolleri değişmedi: bu sözleşme yalnız giriş biçimini
normalleştirir, hiçbir izin gevşetmez.

## Doğrulama

`scripts/test-boundary-input.mjs` yardımcıların kendi davranışını ve yukarıdaki her
giriş noktasını `null`, dizi, string ve sayı girişleriyle sınar; hiçbirinin
`TypeError` fırlatmadığını ve doğru sözleşme kodunu ürettiğini doğrular. Test
`npm run check` kapısına dâhildir.
