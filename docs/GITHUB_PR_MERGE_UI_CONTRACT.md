# GitHub PR Merge UI Contract

## Amaç

Hafize, mevcut server-side GitHub write runtime'ında zaten desteklenen `pr.merge` işlemini yalnız açık kullanıcı onayıyla görünür hale getirir. Bu katman yeni merge yetkisi üretmez; mevcut authentication, repository allowlist, command normalization, approval token, replay protection ve provider execution sınırlarını kullanır.

## Sabit hedef

UI yalnız `umitalgan061-sudo/hafize` deposu için çalışır. Kullanıcı repository değeri seçemez veya değiştiremez.

Merge komutu yalnız şu dört alanı taşır:

- `operation: pr.merge`
- `repository: umitalgan061-sudo/hafize`
- `prNumber`
- `expectedHeadSha`

Bilinmeyen alanlar backend command contract tarafından reddedilir.

## Exact-head güvenliği

`expectedHeadSha` zorunlu 40 karakterlik hexadecimal commit SHA'dır. Kullanıcı onayı belirli PR numarası + belirli head SHA birleşimine bağlanır. Approval hazırlandıktan sonra PR numarası veya SHA değişirse istemci prepared state'i siler.

Backend command boundary exact `expectedHeadSha` değerini GitHub provider'a taşır. GitHub tarafında PR head değişmişse merge başarısız olmalıdır; Hafize yeni head'i sessizce kabul edip merge etmez.

Bu özellik merge queue, auto-merge, force merge veya branch protection atlama davranışı içermez.

## İki aşamalı açık onay

Bir merge için iki ayrı kullanıcı eylemi gerekir:

1. `Onayı hazırla`: exact merge komutu server-side approval boundary'ye gönderilir.
2. `Onayla ve PR’ı birleştir`: yalnız hâlâ aynı komut ve süresi geçmemiş approval token ile execute çağrısı yapılır.

İlk düğme GitHub provider'da merge çalıştırmaz. İkinci düğmeye basılmadan merge gerçekleşmez.

## Approval yaşam döngüsü

Approval token yalnız sayfa belleğinde tutulur. LocalStorage, sessionStorage, IndexedDB, cookie veya clipboard'a kopyalanmaz.

Token biçimi ve expiry istemci tarafında fail-closed doğrulanır; asıl yetkilendirme server-side approval boundary'dir. Süresi dolan veya form değişikliği sonrası eşleşmeyen token execute edilmez.

## Receipt doğrulaması

Başarı yalnız backend şu sanitized receipt'i döndürürse kabul edilir:

- `operation === pr.merge`
- exact repository
- exact PR numarası
- `merged === true`
- geçerli 40 karakterlik merge SHA

UI merge SHA'yı persistent state'e yazmaz. Başarı event'i yalnız operation, repository ve PR numarası taşır.

## Secret ve veri sınırı

Renderer aşağıdaki değerleri okumaz veya üretmez:

- `GITHUB_TOKEN`
- privileged write bearer token
- HttpOnly cloud-session cookie değeri
- approval HMAC secret
- connector owner key
- Redis credentials
- OAuth access/refresh tokenları

Doğrudan `api.github.com` çağrısı yoktur. Yalnız same-origin `/api/github/write/prepare` ve `/api/github/write/execute` kullanılır; `credentials: same-origin` ve `cache: no-store` zorunludur.

## Ajan ve tool sınırı

Bu UI agent tool policy'sini değiştirmez. Dört profilli selector/specialist roster aynıdır. Model veya tool çıktısı merge düğmesine otomatik basamaz; merge kullanıcı arayüzündeki ikinci açık eyleme bağlıdır.

`repo.merge` ajan policy'sinde deny olarak kalabilir; bu kullanıcı kontrollü privileged UI yolu agent permission değildir.

## Erişilebilirlik

Form native button/input elemanları kullanır. Status alanı `role=status`, `aria-live=polite`, `aria-atomic=true` taşır. Mobil dokunma hedefleri en az 44px olur; forced-colors ve reduced-motion davranışları korunur.

## Failure davranışı

Geçersiz PR numarası, SHA, prepared response veya receipt fail-closed reddedilir. 409 sonucu head/command değişimi olarak kullanıcıya yeniden onay hazırlaması gerektiğini bildirir. Network hatası merge başarısı olarak gösterilmez.

## Geri alma

Revert için PR merge JS/CSS/style loader, testler, bu belge ve shell/PWA wiring kaldırılır. Backend write runtime veya GitHub repository state için migration yoktur.
