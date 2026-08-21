# Doğrulama kapısı (check gate)

Hafize'nin statik + smoke test kapısı `scripts/run-checks.mjs` tarafından yürütülür.

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `npm run check` | Tam kapı: syntax kontrolü + registry doğrulaması + tüm test script'leri |
| `npm run precheck` | Hızlı statik geçiş: yalnız syntax kontrolü (`--syntax-only`) |

Her self-development turunda PR hazırlanmadan önce `npm run check` yeşil olmalıdır. Başarısızsa bu gizlenmez; PR açıklamasında açıkça belirtilir.

## Kapsam diskten keşfedilir

Runner kontrol edeceği dosyaları elle yazılmış bir listeden değil doğrudan diskten okur:

- **Syntax (`node --check`)**: `server.mjs`, `lib/*.mjs`, `scripts/*.mjs`, `public/*.js`
- **Doğrulayıcılar**: `scripts/validate-agent-registry.mjs`
- **Testler**: `scripts/test-*.mjs` (alfabetik sırayla)

Bu tasarımın nedeni ölçülmüş bir regresyondur: `package.json` içindeki elle yazılmış `&&` zinciri 53 test script'i çalıştırırken 32 test (`test-canva-read-client`, `test-oauth-*`, `test-hands-free`, `test-screen-share`, `test-schedule-lease-executor` gibi) ve 63 kaynak dosya listeye eklenmediği için sessizce kapının dışında kalmıştı. Keşif diskten yapıldığı sürece yeni bir test dosyası eklemek onu otomatik olarak kapıya dahil eder.

## Yürütme davranışı

- Her script ayrı bir Node process'inde ve **sıralı** çalışır. Sıralı yürütme, port bağlayan `test-server-startup-integration` gibi testlerin birbirini etkilemesini önler.
- Her script için **120 saniye** timeout uygulanır; takılan bir test kapıyı süresiz bloklamaz, `TIMEOUT` olarak raporlanır.
- İlk hatada durulmaz. Tüm hatalar toplanır ve çıktının sonunda tek blokta raporlanır; böylece bir turda birden fazla kırık test tek çalıştırmada görülür.
- Herhangi bir syntax veya test hatasında process `1` ile çıkar.

## Yeni test eklerken

1. Dosyayı `scripts/test-<konu>.mjs` adıyla oluştur — `test-` öneki onu otomatik olarak kapıya dahil eder.
2. Başarıda tek satırlık bir özet yazdır, başarısızlıkta throw et (`node:assert/strict` yeterlidir).
3. Test dış ağ, canlı Redis veya gerçek credential gerektirmemelidir; bu bağımlılıklar yoksa test kendini atlamalı veya sahte (fake) bağımlılıkla çalışmalıdır.
4. `package.json` düzenlemeye gerek yoktur.
