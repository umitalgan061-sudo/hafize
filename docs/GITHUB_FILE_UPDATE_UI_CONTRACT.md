# GitHub File Update UI Contract

## Amaç

Hafize, mevcut GitHub write runtime'ındaki `file.update` operasyonunu yalnız açık kullanıcı onayıyla görünür bir arayüze bağlar. Bu katman yeni GitHub yetkisi oluşturmaz; server-side command/approval/execution sınırını kullanır.

## Sabit hedef

UI yalnız `umitalgan061-sudo/hafize` deposunu hedefler. Repository alanı kullanıcı girdisi değildir. Hedef branch mutlaka `hafize/` öneki taşır.

Dosya güncellemesi tam dosya içeriğiyle yapılır. Kullanıcı şunları açıkça sağlar:

- hedef `hafize/` branch,
- repo-relative dosya yolu,
- mevcut 40 karakterlik blob SHA,
- kısa commit mesajı,
- yeni tam UTF-8 içerik.

## Optimistic concurrency

`expectedBlobSha` zorunludur. Böylece kullanıcı onay hazırladıktan sonra dosyanın başka bir işlem tarafından değiştirilmesi sessizce ezilmez. Backend mevcut blob SHA eşleşmesini tekrar doğrular; stale SHA başarısız olur.

Başarılı receipt yeni `commitSha` ve `blobSha` döndürür. UI yalnız receipt operation/repository/branch/path ve iki SHA alanı exact doğrulanırsa başarı gösterir.

## İki aşamalı açık onay

İlk kullanıcı eylemi `/api/github/write/prepare` üzerinden exact normalize edilmiş `file.update` komutu için kısa ömürlü approval hazırlar. Dosya branch/path/SHA/commit/content alanlarından herhangi biri değişirse bu approval istemci tarafında hemen geçersizleştirilir.

İkinci ayrı düğme `/api/github/write/execute` çağrısını başlatır. Approval süresi dolmuşsa veya komut değişmişse execute gönderilmez.

## Path ve içerik sınırı

UI backend sözleşmesini erken geri bildirim için yansıtır:

- dosya yolu en fazla 400 karakter,
- mutlak path, backslash, NUL, boş segment, `.` ve `..` reddedilir,
- `.github/workflows/` otomatik self-development alanı değildir,
- `.env`, credential, secret, token, private-key ve PEM/key/P12/PFX benzeri hassas segmentler reddedilir,
- içerik boş olamaz ve en fazla 64 KiB UTF-8 olabilir,
- commit mesajı en fazla 200 karakterdir.

Asıl güvenlik kararı yine backend'dedir; istemci doğrulaması yetkilendirme değildir.

## Secret ve veri sınırı

Renderer şu değerleri okumaz veya saklamaz:

- `GITHUB_TOKEN`,
- write bearer token,
- HttpOnly cloud-session cookie değeri,
- approval HMAC secret,
- owner key,
- Redis credential,
- connector OAuth credential.

Approval token yalnız kısa ömürlü process-memory state'te tutulur. `localStorage`, `sessionStorage`, IndexedDB, cookie API ve clipboard kullanılmaz.

## Network sınırı

UI yalnız aynı origin üzerindeki iki mevcut endpoint'e POST yapar:

- `/api/github/write/prepare`
- `/api/github/write/execute`

Her iki çağrı `credentials: same-origin` ve `cache: no-store` kullanır. Doğrudan `api.github.com` çağrısı yoktur.

## Ajan ve tool sınırı

Bu UI yeni ajan, skill veya tool permission eklemez. Dört profilli selector/specialist roster aynen korunur. Model veya tool çıktısı ikinci onay düğmesine kullanıcı yerine basamaz.

`repo.merge`, workflow değişikliği ve başka repolara yazma bu yüzeyin kapsamında değildir.

## PWA ve lifecycle

Dosya güncelleme modülü, style bootstrap ve CSS PWA shell cache v72'ye eklenir. GitHub readiness kartı dinamik yüklendiği için mount en fazla 10 saniyelik bounded MutationObserver kullanabilir; mount veya timeout sonrasında observer temizlenir.

Escape, işlem sürmüyorsa formu kapatır. Destroy aktif isteği iptal eder, listener/observer/timer ve üretilen DOM'u temizler.

## Geri alma

Revert; `github-file-update.js`, CSS/style bootstrap, testler, bu belge, chat enhancement wiring ve v72 PWA asset kayıtlarını kaldırır. Backend GitHub write sözleşmesinde migrasyon veya yetki değişikliği yoktur.
