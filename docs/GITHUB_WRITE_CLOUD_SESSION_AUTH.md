# GitHub Write Cloud Session Authentication Contract

## Amaç

Hafize'nin GitHub write runtime'ı branch oluşturma, dosya güncelleme, draft PR açma ve merge gibi yüksek etkili işlemleri iki aşamalı approval sınırıyla yürütür. Bu belge yalnız bu runtime'ın web/PWA oturumundan nasıl kimlik doğruladığını tanımlar.

Bu değişiklik yeni bir GitHub yazma yetkisi açmaz. Mevcut `/api/github/write/prepare` ve `/api/github/write/execute` endpoint'leri, repository allowlist'i, approval tokenı, replay store'u ve operation sözleşmesi aynen korunur.

## Kimlik doğrulama sırası

Privileged authenticator iki kaynağı destekler:

1. Mevcut `HAFIZE_GITHUB_WRITE_AUTH_TOKEN` + `HAFIZE_GITHUB_WRITE_AUTH_SUBJECT` bearer kimliği.
2. Hafize cloud-session HttpOnly cookie'si.

Bearer geçerliyse doğrudan kullanılır. Bearer yoksa veya geçersizse ve cloud session yapılandırılmışsa imzalı session cookie doğrulanır. İki yöntem de başarısızsa sonuç `AUTH_REQUIRED` olur.

Bu sıra mevcut server-to-server bearer istemcilerini bozmadan tarayıcıdaki authenticated Hafize oturumunun aynı approval boundary'ye ulaşmasını sağlar.

## Cloud-session sınırı

Cloud session yalnız şu server-side environment alanları tam yapılandırılmışsa fallback olarak etkinleşir:

- `HAFIZE_CLOUD_SESSION_PASSWORD_HASH`
- `HAFIZE_CLOUD_SESSION_SIGNING_KEY`
- `HAFIZE_CLOUD_SESSION_SUBJECT`
- `HAFIZE_CLOUD_SESSION_ORIGIN`

TTL varsa `HAFIZE_CLOUD_SESSION_TTL_MS` mevcut 1 dakika–12 saat sınırında olmalıdır. Partial veya geçersiz cloud-session konfigürasyonu sessizce kabul edilmez; runtime fail-closed yapılandırma hatası verir.

Password hash yalnız cloud-session auth nesnesinin mevcut sözleşmesini doğrulamak için gereklidir. GitHub write runtime parola istemez, login yapmaz ve password hash değerini hiçbir response veya agent context'e taşımaz.

## Principal davranışı

Başarılı authenticator sonucu yalnız şu principal biçimini kabul eder:

```text
{ authenticated: true, subject: <bounded string> }
```

Subject boş olamaz ve 200 karakteri aşamaz. GitHub owner kimliği bundan sonra mevcut `connector-owner-principal` HMAC sınırıyla server-side türetilir.

Cloud-session subject değeri GitHub ownerId değildir ve istemciye ownerId olarak gönderilmez.

## Approval sınırı değişmez

Kimlik doğrulama başarıyla tamamlandıktan sonra write işlemi hâlâ iki ayrı aşamadan geçer:

1. `prepare` komutu exact GitHub write contract ile normalize eder ve kısa ömürlü, owner-bound, command-digest-bound approval token üretir.
2. `execute` aynı komut + approval tokenı yeniden doğrular; owner, expiry, command digest ve replay claim eşleşmeden GitHub çağrısı yapılmaz.

Dolayısıyla geçerli Hafize web oturumu tek başına sessiz write izni değildir. Uygulama yine açık kullanıcı eylemiyle prepare/execute akışını tamamlamak zorundadır.

## Yetki ve operation sınırı

Bu auth değişikliği aşağıdakileri genişletmez:

- repository allowlist,
- `hafize/` branch prefix zorunluluğu,
- sensitive path ve `.github/workflows/` engelleri,
- dosya boyutu / commit message sınırları,
- draft-only PR oluşturma,
- exact-head merge kontrolü,
- replay protection,
- GitHub token erişimi.

Agent tool policy de değişmez. Model veya tool çağrısı web session cookie'sini okuyamaz ve approval tokenı kendiliğinden kullanıcı niyeti sayamaz.

## Secret sınırı

Aşağıdakiler client JavaScript'e, response body'ye veya agent context'e taşınmaz:

- `GITHUB_TOKEN`,
- GitHub write bearer tokenı,
- cloud-session signing key,
- cloud-session password hash,
- approval secret,
- owner derivation key,
- Redis replay credentials,
- HttpOnly session cookie değeri.

Authenticator yalnız request header/cookie verisini server-side doğrular.

## Failure davranışı

- Bearer invalid + cloud session valid → cloud principal kullanılabilir.
- Bearer valid → cloud fallback'e gerek kalmaz.
- Bearer invalid + cloud invalid/yok → `AUTH_REQUIRED`.
- Partial cloud config → runtime configuration error; sessiz auth downgrade yok.
- Expired, malformed veya yanlış imzalı cookie → `AUTH_REQUIRED`.
- Geçerli auth fakat approval mismatch/replay/expiry → mevcut GitHub write approval hataları aynen korunur.

## Geriye uyumluluk

Cloud session yapılandırılmamışsa mevcut bearer davranışı aynen devam eder. GitHub write runtime'ın etkinlik konfigürasyonu ve mevcut bearer env gereksinimleri bu turda kaldırılmamıştır.

Bu bilinçli bir migration yaklaşımıdır: browser session fallback eklenir, mevcut servis kimliği kaldırılmaz.

## Test / DoD

Regresyon testleri en az şunları doğrulamalıdır:

- bearer-only başarı,
- cloud-only fallback başarısı,
- bearer precedence,
- geçersiz bearer + geçerli cookie fallback'i,
- expired/malformed cookie reddi,
- partial cloud config fail-closed,
- cloud fallback devre dışıyken bearer-only davranışı,
- GitHub write server runtime'ın yeni authenticator'ı kullanması,
- approval/owner/replay modüllerinin değiştirilmemesi,
- secret değerlerin response veya client asset'e taşınmaması.

## Geri alma

Revert için `privileged-principal-auth.mjs`, ilgili testler/bu belge kaldırılır ve `github-write-server-runtime.mjs` tekrar doğrudan bearer authenticator kullanır. GitHub repository state veya persistent storage migration'ı yoktur.
