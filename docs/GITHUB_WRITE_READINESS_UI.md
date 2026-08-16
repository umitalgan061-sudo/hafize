# GitHub yazma hazır-olma yüzeyi

Hafize utility rail içindeki `GitHub yazma` kartı yalnız `GET /api/health` yanıtındaki `githubWriteConfigured` boolean sinyalini gösterir. Kart bir GitHub yazma aracı değildir ve approval token üretmez.

## Gösterilen durum

- `githubWriteConfigured=true`: sunucu tarafı GitHub write runtime'ı yapılandırılmıştır; gerçek yazma yine ayrı approval boundary'den geçmek zorundadır.
- `githubWriteConfigured=false`: write runtime kapalıdır; kart kullanıcıya salt-okunur repo araçlarının ayrı olduğunu açıklar.
- Geçersiz/ulaşılamayan health yanıtı fail-closed `Bilinmiyor` durumuna döner.

## Güvenlik sınırı

Kart yalnız same-origin, `cache: no-store` GET isteği yapar. `/api/github/write/prepare` veya `/api/github/write/execute` çağrısı yapmaz. GitHub tokenı, repository allowlist'i, auth bearer tokenı, owner key, approval secret veya replay-store ayrıntısı istemciye taşınmaz.

Branch, commit veya PR yazımı ancak mevcut backend approval/execution boundary üzerinden yapılabilir. Merge, repo silme, secret görüntüleme veya koruma devre dışı bırakma bu UI tarafından sunulmaz.

## Test sözleşmesi

`scripts/test-github-write-readiness.mjs` health normalizasyonu, ready/off/error metinleri, exact GET sözleşmesi, DOM/ARIA lifecycle ve cleanup davranışını doğrular. `scripts/test-github-write-readiness-integration.mjs` loader/PWA wiring, server health kaynağı ve forbidden write/secret API desenlerini kilitler.
