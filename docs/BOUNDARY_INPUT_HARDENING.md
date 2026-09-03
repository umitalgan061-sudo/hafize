# Sınır Girdisi Sertleştirmesi

## Sorun

Depodaki güvenlik sınırları yaygın olarak şu imzayı kullanıyordu:

```js
async function execute(args, { principal, approvalGranted = false } = {}) { … }
```

JavaScript'te varsayılan parametre **yalnızca `undefined`** için devreye girer.
Çağıran taraf `null` (veya dizi, string, sayı) geçtiğinde destructuring ham bir
`TypeError` fırlatır:

```
TypeError: Cannot destructure property 'principal' of '(intermediate value)' as it is null.
```

Bu üç açıdan sorunluydu:

1. **Sözleşme kaybı.** Sınırın kendi tipli hatası (`INVALID_GMAIL_READ`,
   `AUTH_REQUIRED`, …) yerine iç uygulama detayı taşıyan bir istisna oluşuyordu.
   Hata eşlemesi bu sözleşmelere göre yazıldığı için beklenmedik dala düşüyordu.
2. **Fail-closed belirsizliği.** `approvalGranted = false` gibi güvenli
   varsayılanlar hiç uygulanmıyordu; koruma çökme yolunda atlanıyordu.
3. **Test boşluğu.** `lib/gmail-read-client.mjs` bu nedenle `INVALID_GMAIL_READ`
   yerine `TypeError` üretiyor ve `scripts/test-gmail-read-client.mjs` kırmızı
   kalıyordu; `npm run check` bu noktada durduğu için sonraki tüm testler
   hiç çalışmıyordu.

## Çözüm

`lib/boundary-input.mjs` iki küçük yardımcı sunar:

- `isPlainInput(value)` — düz nesne mi (dizi ve `null` hariç).
- `optionsOf(value)` — nesne değilse dondurulmuş boş nesneye indirger.

Sınırlar artık girdiyi destructure etmeden önce bundan geçirir; böylece mevcut
doğrulama adımları normal çalışır ve sınır kendi tipli hatasını üretir.

```js
async function execute(args, context) {
  // Bağlam eksik veya bozuksa onay verilmemiş sayılır (fail-closed).
  const { principal, approvalGranted = false } = optionsOf(context);
  …
}
```

## Kapsanan sınırlar

| Modül | Giriş noktası | `null` girdide davranış |
| --- | --- | --- |
| `lib/gmail-read-client.mjs` | `read(request)` | `INVALID_GMAIL_READ:request` |
| `lib/canva-read-client.mjs` | `read(request)` | `INVALID_CANVA_READ:request` |
| `lib/gmail-read-tool-boundary.mjs` | `execute(args, context)` | `INVALID_GMAIL_READ_TOOL:owner` |
| `lib/canva-read-tool-boundary.mjs` | `execute(args, context)` | `INVALID_CANVA_READ_TOOL:owner` |
| `lib/gmail-send-tool-boundary.mjs` | `execute(args, context)` | `GMAIL_SEND_APPROVAL_REQUIRED` |
| `lib/server-auth.mjs` | `authenticate(request)` | `{ ok: false, error: 'AUTH_REQUIRED' }` |
| `lib/schedule-command-boundary.mjs` | `create` / `list` / `cancel` | `{ ok: false, error: 'AUTH_REQUIRED' }` |
| `lib/schedule-http-api.mjs` | `handle(incoming)` | `{ matched: false }` |
| `lib/memory-retrieval-boundary.mjs` | `normalizeMemoryRetrieval(input)` | `{ ok: false, error: 'INVALID_MEMORY_RETRIEVAL:ownerId' }` |
| `lib/github-write-contract.mjs` | `normalizeGitHubWriteRequest(input, options)` | `GITHUB_WRITE_REPOSITORY_NOT_ALLOWED` |

Okuma istemcilerinde ayrıca üst düzey alan allowlist'i uygulanır
(`ownerId`, `operation`, `params`); bilinmeyen alan artık sessizce yutulmak
yerine `INVALID_*_READ:request.<alan>` üretir.

## Doğrulama

- `node scripts/test-boundary-null-input.mjs` — her sınır için `null`,
  `undefined`, sayı, boş string, `false`, dizi ve fonksiyon girdileri; ayrıca
  onaysız bağlamın hiçbir koşulda gönderim veya store yazımı tetiklemediği.
- `npm run check` ve `npm run precheck` tam olarak yeşil.

## Geri alma

`lib/boundary-input.mjs` ile `scripts/test-boundary-null-input.mjs` silinip
ilgili commit `git revert` edilir. Yardımcı yalnızca girdi normalleştirir;
davranışsal bağımlılığı yoktur.
