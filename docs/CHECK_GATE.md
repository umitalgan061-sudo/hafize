# Doğrulama kapısı (check gate)

`npm run check` Hafize'nin tek doğrulama kapısıdır ve `scripts/run-checks.mjs` tarafından yürütülür.

## Neden keşif tabanlı

Kapı daha önce `package.json` içinde elle bakılan tek bir `&&` zinciriydi. Bu tasarımın iki yapısal sorunu vardı:

- **Sessiz kapsam kaybı.** Yeni bir test dosyası eklendiğinde zincire yazılmayı unutmak kolaydı. 85 test dosyasının 32'si — OAuth, PKCE, token şifreleme, Google/Canva token exchange ve personal memory şifreleme testlerinin tamamı dâhil — hiç çalışmıyordu.
- **İlk hatada durma.** `&&` zinciri ilk başarısızlıkta kesiliyor, arkasındaki tüm testler çalışmadan kapı kapanıyordu. Bu nedenle `scripts/test-tool-runtime.mjs` içindeki eskimiş bir araç listesi, zincirin geri kalanını da görünmez hale getirmişti.

Yeni kapı hedefleri dosya sisteminden keşfeder. Bir testin kapıdan düşmesi artık elle yapılan bir hata değil, ancak dosyanın silinmesiyle mümkündür.

## Kapsam

| Aşama | Kaynak |
| --- | --- |
| Syntax (`node --check`) | `server.mjs`, `lib/*.mjs`, `public/*.js`, `scripts/*.mjs` |
| Doğrulayıcılar | `scripts/validate-agent-registry.mjs` |
| Testler | `scripts/test-*.mjs` (tümü) |

Kapı tüm paketleri çalıştırır ve **tüm** başarısızlıkları çıktısıyla birlikte raporlar; ilk hatada durmaz. Herhangi bir başarısızlıkta çıkış kodu `1`'dir.

## Kullanım

```bash
npm run check              # tam kapı
npm run check -- gmail     # yalnız yolunda "gmail" geçen hedefler
```

Filtre argümanı yerel geliştirme kolaylığı içindir; CI her zaman filtresiz çalıştırır.

## Harici servis gerektiren testler

Canlı servis isteyen testler kendi içlerinde atlama kararı verir ve `0` ile çıkar; kapının ayrı bir dışlama listesi **yoktur**. Örnek: `scripts/test-redis-schedule-lease-live.mjs`, `HAFIZE_TEST_REDIS_URL` tanımlı değilse atlar. Bu yaklaşım, dışlama listesinin zamanla çürümesini önler.

## Kapının kendi testi

`scripts/test-check-gate.mjs` kapının sözleşmesini doğrular:

- diskteki her `scripts/test-*.mjs` dosyası keşfedilir (eksik veya fazla yok);
- daha önce zincirden düşmüş güvenlik testleri kapsamdadır;
- syntax hedefleri `server.mjs`, `lib/`, `public/` ve `scripts/` katmanlarını kapsar;
- başarısız bir test paketi kapıyı kırar ve çıktısı gizlenmez;
- bozuk syntax kapıyı kırar.

Bu test de kapı tarafından keşfedildiği için kendi kendini kapsar.

## Geri alma

`package.json` içindeki `check` betiği eski `&&` zinciriyle değiştirilebilir; `scripts/run-checks.mjs` ve `scripts/test-check-gate.mjs` bağımsız dosyalardır ve silinmeleri üretim davranışını etkilemez.
