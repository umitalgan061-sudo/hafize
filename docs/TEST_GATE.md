# Hafize test kapısı

`npm run check` tek bir çalıştırıcıya bağlıdır: `scripts/run-tests.mjs`.

## Neden

Kapı önceden `package.json` içinde elle tutulan uzun bir `&&` zinciriydi. Bu yapının iki ölçülebilir sorunu vardı:

- Yeni yazılan testler zincire eklenmediğinde sessizce hiç çalışmıyordu (85 testin 32'si kapı dışındaydı; ayrıca `test-schedule-lease-executor.mjs` yalnız syntax kontrolüne alınmıştı).
- Zincir ilk hatada durduğu için tek bir eski assertion, arkasındaki tüm testleri gizliyordu.

## Sözleşme

- `scripts/` altındaki `test-*.mjs` ve `validate-*.mjs` dosyaları dosya sisteminden keşfedilir; yeni test eklemek için başka bir yeri güncellemek gerekmez.
- `server.mjs`, `lib/*.mjs`, `public/*.js` ve `scripts/*.mjs` dosyalarının tümü `node --check` ile statik olarak doğrulanır.
- Çalıştırma ilk hatada durmaz; tüm başarısızlıklar toplanır ve sonda tam çıktısıyla raporlanır. Bir hata varsa çıkış kodu `1`'dir.
- Her script en fazla 120 saniye çalışabilir; takılan bir test kapıyı süresiz bloke etmez.
- Bir test kapı dışında bırakılacaksa `run-tests.mjs` içindeki `SKIPPED` haritasına açık gerekçesiyle yazılır ve çıktıda `SKIP` satırı olarak görünür. Şu anda hiçbir test atlanmıyor.

## Komutlar

| Komut | Kapsam |
| --- | --- |
| `npm run check` | Tüm syntax kontrolleri + tüm test/validator script'leri |
| `npm run precheck` | Hızlı ön uç alt kümesi (voice, ui-shell, sidebar, hands-free, screen-share) |
| `node scripts/run-tests.mjs <parça> [...]` | Adı verilen parçalardan birini içeren dosyalar |

## Doğrulama

`scripts/test-gate-coverage.mjs` kapının kendi sözleşmesini test eder: her test ya çalışır ya da gerekçeli olarak atlanır, tüm kaynaklar syntax kontrolündedir ve `npm run check` / `npm run precheck` elle tutulan zincire geri dönemez.

## Geri alma

`package.json` içindeki `check` / `precheck` komutları eski zincire döndürülerek geri alınabilir; `scripts/run-tests.mjs` ve `scripts/test-gate-coverage.mjs` başka hiçbir modül tarafından import edilmez.
