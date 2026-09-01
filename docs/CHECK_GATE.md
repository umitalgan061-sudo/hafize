# Check Gate — otomatik keşifli doğrulama

`npm run check`, `scripts/run-checks.mjs` üzerinden çalışır. Amaç: gate'in içeriğinin
elle güncellenen bir komut zincirine değil, depodaki gerçek dosyalara bağlı olması.

## Neden

Gate daha önce `package.json` içinde tek satırlık dev bir `&&` zinciriydi. Yeni bir
`lib/*.mjs` veya `scripts/test-*.mjs` dosyası eklendiğinde zincire elle eklenmesi
gerekiyordu ve bu adım sık sık atlanıyordu: 85 test dosyasının 32'si (tüm OAuth,
token şifreleme, Canva/Google connector ve kişisel bellek testleri dâhil) hiç
çalışmıyordu. Zincir ilk hatada durduğu için de tek bir eskimiş assertion arkasındaki
diğer başarısızlıklar görünmüyordu.

## Ne yapar

1. **Syntax denetimi** — `server.mjs` ile `lib/*.mjs`, `public/*.js`, `scripts/*.mjs`
   altındaki tüm dosyalar için `node --check`. Dizin taranarak bulunur, liste tutulmaz.
2. **Doğrulayıcılar** — `scripts/validate-agent-registry.mjs`.
3. **Testler** — `scripts/test-*.mjs` kalıbına uyan her dosya.

Adımlar varsayılan olarak 4 paralel işçiyle çalışır; her adım kendi süresiyle
raporlanır ve başarısız adımların tam çıktısı özetin sonunda toplu olarak yazılır.
Zincirin aksine ilk hatada durmaz, tüm hataları tek turda gösterir.

## Komutlar

| Komut | Kapsam |
| --- | --- |
| `npm run check` | Tam gate (syntax + doğrulayıcı + testler) |
| `npm run precheck` | Yalnızca frontend/UX testleri (hızlı döngü) |
| `npm run check:live` | Dışlananlar dâhil; canlı bağımlılık gerektirir |
| `npm run check:plan` | Çalıştırmadan planı JSON olarak yazdırır |

Ek bayraklar: `--filter <terim[,terim]>` (OR eşleşmesi), `--concurrency <1-16>`,
`--include-live`, `--list`.

## Dışlama kuralı

Bir test yalnızca `scripts/run-checks.mjs` içindeki `EXCLUDED_TESTS` haritasında
gerekçesiyle listelenerek gate dışında bırakılabilir. Şu an tek dışlama
`test-redis-schedule-lease-live.mjs` (canlı Redis gerektirir).

`scripts/test-check-runner.mjs` bu sözleşmeyi test eder: her test dosyası ya
planlanmış ya da gerekçeli olarak dışlanmış olmalıdır, gerekçe boş olamaz,
`--include-live` tüm dosyaları plana almalıdır ve `package.json` içindeki `check`
adımı yeniden elle zincirlenmiş olmamalıdır. Yani gate'in yeniden çürümesi testle
engellenir.

## Geri alma

`package.json` içindeki `scripts` bloğu eski zincire döndürülür; `scripts/run-checks.mjs`
ve `scripts/test-check-runner.mjs` silinir. Kütüphane davranışı etkilenmez.
