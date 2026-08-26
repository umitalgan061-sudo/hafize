# Doğrulama Kapısı

`npm run check`, depodaki kaynak ve test dosyalarını **otomatik keşfeden** tek bir
kapıdır. Uygulaması `scripts/run-checks.mjs`, kendi testi `scripts/test-run-checks.mjs`.

## Neden değişti?

Kapı daha önce `package.json` içinde elle bakımı yapılan iki uzun komut zinciriydi.
Yeni bir test dosyası eklendiğinde bu zincire ayrıca yazılması gerekiyordu ve
yazılmadığında test sessizce hiç çalışmıyordu. Bu iki somut soruna yol açmıştı:

- 85 test dosyasının 33'ü (OAuth, PKCE, token şifreleme ve kişisel bellek dahil)
  hiç çalıştırılmıyordu.
- Zincir `&&` ile bağlı olduğu için ilk başarısızlık kalan ~100 kontrolü de
  iptal ediyordu; `scripts/test-tool-runtime.mjs` içindeki eskimiş bir beklenti
  yüzünden kapı tamamen kırmızıydı ve arkasındaki hatalar görünmüyordu.

## Kapsam

| Komut | Sözdizimi | Test |
| --- | --- | --- |
| `npm run check` | `server.mjs`, `lib/`, `public/`, `scripts/` | tüm `scripts/test-*.mjs` |
| `npm run precheck` | `public/` | yalnızca frontend testleri |

Keşif kuralları:

- Sözdizimi kontrolü `.mjs` ve `.js` uzantılarını kapsar; `node_modules` ve `.git` atlanır.
- Test dosyası, adı `test-` ile başlayan her `scripts/*.mjs` dosyasıdır.
- Kapı, tek bir hatada durmaz; tüm kontrolleri çalıştırır ve başarısızlıkları
  sonda toplu olarak raporlayıp `1` ile çıkar.

## Test atlama (opt-in)

Dış servis gerektiren testler `run-checks.mjs` içindeki `OPT_IN_TESTS` haritasında
açık gerekçesiyle listelenir ve her çalıştırmada `Atlandı (opt-in): …` satırıyla
raporlanır. Sessiz atlama yoktur; `scripts/test-run-checks.mjs` her girdinin
gerekçe taşıdığını doğrular.

Şu an tek girdi `scripts/test-redis-schedule-lease-live.mjs` (canlı Redis gerektirir).

## Kapının kendi güvencesi

`scripts/test-run-checks.mjs` şunları doğrular:

- Keşif, diskteki her test dosyasını kapsar (opt-in listesi hariç) — sessiz düşürme yok.
- Başarısız bir test ve sözdizimi hatası kapıyı gerçekten `1` ile düşürür.
- Hiç test bulunamaması sessiz bir "geçti" değil, hatadır.

Bu doğrulamalar gerçek test paketini yeniden çalıştırmamak için geçici bir fixture
kökünde (`--root=<dizin>`) yapılır; kapı kendi içine özyinelemez.

## Yeni test eklerken

Dosyayı `scripts/test-*.mjs` olarak oluşturmak yeterlidir. `package.json`
güncellenmez.

## Geri alma

`package.json` içindeki `check` / `precheck` betikleri eski komut zincirlerine
döndürülür ve `scripts/run-checks.mjs` ile `scripts/test-run-checks.mjs` silinir.
