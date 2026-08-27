# Connector sınırlarında null argüman sözleşmesi

## Sorun

JavaScript'te varsayılan parametre (`function f(x = {})`) yalnızca
`undefined` için devreye girer, `null` için girmez. Connector sınırları
şu biçimde yazılmıştı:

```js
async function read({ ownerId, operation, params } = {}) { … }
```

`read(null)` çağrısı bu yüzden doğrulamaya hiç ulaşmadan ham bir
`TypeError` fırlatıyordu:

> `Cannot destructure property 'ownerId' of '(intermediate value)' as it is null.`

Bu, güvenlik sınırlarında üç somut soruna yol açıyordu:

1. **Hata sınıflandırması kayboluyordu.** `lib/tool-runtime.mjs`
   `error.code` alanına bakar; ham `TypeError`'da bu alan yoktur, bu
   yüzden spesifik doğrulama hatası yerine genel `TOOL_EXECUTION_FAILED`
   raporlanıyordu.
2. **Hata mesajı iç yapıyı açığa vuruyordu.** `TypeError` metni
   destructure edilen alan adlarını içerir; sınırların geri kalanı
   bilinçli olarak sadece sabit hata kodları döndürür.
3. **Fail-closed davranış örtük hâle geliyordu.** `gmail_send`
   sınırında `execute(args, null)` çağrısı onay kontrolüne ulaşmadan
   `TypeError` ile düşüyordu. Gönderim yapılmıyordu, ancak reddin nedeni
   "onay yok" değil, sınıflandırılmamış bir çalışma zamanı hatasıydı.

## Sözleşme

Aşağıdaki tüm giriş noktaları `null`, dizi ve nesne olmayan argümanlarda
kendi sözleşme hatasını fırlatır; ham `TypeError` sızdırmaz:

| Giriş noktası | Hata |
| --- | --- |
| `createGmailReadClient(options)` / `read(request)` | `INVALID_GMAIL_READ:*` |
| `createCanvaReadClient(options)` / `read(request)` | `INVALID_CANVA_READ:*` |
| `createGmailReadToolBoundary(deps)` / `execute(args, context)` | `INVALID_GMAIL_READ_TOOL:*` |
| `createCanvaReadToolBoundary(deps)` / `execute(args, context)` | `INVALID_CANVA_READ_TOOL:*` |
| `createGmailSendToolBoundary(deps)` / `execute(args, context)` | `INVALID_GMAIL_SEND_TOOL:*` |
| `normalizeGmailSendRequest(input, options)` | `INVALID_GMAIL_SEND_OPTIONS` |

Ek olarak:

- Read client `request` nesnesi **strict**'tir: yalnızca `ownerId`,
  `operation` ve `params` alanlarına izin verilir; bilinmeyen alan
  taşıyan istek reddedilir (least privilege).
- `context` verilmediğinde `principal` `undefined` kalır; çağrı sessizce
  başka bir kimliğe düşmez, sahiplik kararını `ownerResolver` verir.
- `gmail_send` için `context` verilmediğinde veya `approvalGranted`
  `true` değilse sonuç `GMAIL_SEND_APPROVAL_REQUIRED`'dır — fail-closed
  davranış artık açıkça bu kodla raporlanır.

## Doğrulama

`scripts/test-connector-null-input-boundary.mjs` her giriş noktasını
`null`, `'string'`, `42`, `true` ve `[]` argümanlarıyla çağırır; hem
hatanın `TypeError` **olmadığını** hem de beklenen sözleşme kodunu
taşıdığını doğrular. Onaylı gönderim ve normal read akışı da aynı testte
regresyona karşı korunur.
