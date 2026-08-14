# GitHub write HTTP güvenlik sözleşmesi

Bu katman, mevcut exact-user-approved GitHub write çekirdeğini production server'a bağlamadan önce authenticated HTTP sınırı olarak hazırlar.

## Endpoint sözleşmesi

Yalnız iki backend endpoint'i tanımlıdır:

- `POST /api/github/write/prepare` — normalize edilmiş bir komut için kısa ömürlü, kullanıcıya ve exact komuta bağlı approval token üretir.
- `POST /api/github/write/execute` — aynı authenticated kullanıcı, aynı exact komut ve tek kullanımlık approval token ile işlemi yürütür.

Her iki endpoint de bearer authentication ister. Model/tool çağrısı bu bearer kimliğini veya approval token'ını üretme yetkisine sahip değildir.

## Fail-closed configuration

Write yüzeyi varsayılan kapalıdır. Yalnız aşağıdaki server-side değerlerin tamamı varsa runtime configured olur:

- `GITHUB_TOKEN`
- `HAFIZE_GITHUB_WRITE_REPOS`
- `HAFIZE_GITHUB_WRITE_APPROVAL_SECRET`
- `HAFIZE_GITHUB_WRITE_AUTH_TOKEN`
- `HAFIZE_GITHUB_WRITE_AUTH_SUBJECT`
- `HAFIZE_GITHUB_WRITE_OWNER_KEY`

Write-specific değişkenlerin hiçbiri yoksa runtime disabled kalır. Bunlardan herhangi biri var fakat set eksikse startup composition fail-closed hata üretir. Approval secret ve owner key base64url olarak sunulur; owner key tam 32 byte, approval secret en az 32 byte olmalıdır.

## Yetki sınırı

HTTP katmanı mevcut `github-write-contract`, approval, execution ve REST client sınırlarını değiştirmez. Bu nedenle repository allowlist, `hafize/*` branch zorunluluğu, exact blob SHA, secret/workflow path blokları, draft PR zorunluluğu ve head-SHA-pinned merge kuralları aynen geçerlidir.

Prepare endpoint'i GitHub'a network yazısı yapmaz. Execute endpoint'i approval token tüketildikten sonra writer'ı çağırır. Provider hatası veya başarısız write token'ı harcar; retry için yeni kullanıcı onayı gerekir.

## Veri minimizasyonu

Public cevaplar yalnız normalize command, expiry, approval token veya sanitize receipt taşır. GitHub bearer token, authenticated subject, owner id, approval secret, owner key, provider response body, filesystem path veya ham exception detail public cevaba yansıtılmaz.

## Bilinçli sınır

Bu PR `server.mjs` route wiring'i açmaz ve NVIDIA/model tool catalog'a write tool eklemez. Production wiring ayrı turda health boolean + request abort propagation + live HTTP regression testiyle yapılmalıdır. Böylece yeni dış-yazma yüzeyi tek PR'da hem composition hem server routing değişikliğiyle büyütülmez.
