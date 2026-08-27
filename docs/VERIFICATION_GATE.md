# Doğrulama kapısı (`npm run check`)

Hafize'nin tek doğrulama kapısı `scripts/run-checks.mjs` üzerinden çalışır.

## Neden değişti

Önceki kapı `package.json` içinde elle yazılmış, `&&` ile zincirlenmiş uzun bir komut dizisiydi. Bu yapının iki somut arızası vardı:

1. **Fail-fast gizleme.** Zincir ilk hatada durduğu için arkasındaki tüm hatalar görünmez oluyordu. `main` üzerinde `scripts/test-tool-runtime.mjs` kırıkken arkasındaki `scripts/test-gmail-read-client.mjs` hatası hiç raporlanmadı.
2. **Kapsam kayması.** Yeni dosya eklendiğinde zincire elle kaydedilmesi gerekiyordu. Kayıt unutulduğu için diskteki 85 test dosyasının 37 tanesi kapının tamamen dışında kalmıştı.

## Yeni davranış

- **Keşif tabanlı kapsam.** Hedefler diskten okunur: `server.mjs`, `lib/*.mjs`, `scripts/*.mjs`, `public/*.js` syntax kontrolünden geçer; `scripts/test-*.mjs` ve `scripts/validate-*.mjs` ayrıca çalıştırılır. Yeni bir test dosyası eklemek kapıya dahil olmak için yeterlidir; `package.json` düzenlenmez.
- **Toplayıcı raporlama.** Kapı ilk hatada durmaz. Tüm hedefler çalışır, her başarısız hedef ayrı ayrı raporlanır ve özet satırı başarısız hedeflerin listesini verir.
- **Deterministik çıkış kodu.** Tek bir hedef bile başarısızsa süreç `1` ile çıkar; tümü geçerse `0`.
- **Zaman aşımı koruması.** Bir hedef 120 saniyeyi aşarsa `SIGKILL` ile sonlandırılır ve başarısız sayılır; asılı kalan test kapıyı süresiz bloke edemez.
- **Sınırlı paralellik.** En fazla 4 hedef aynı anda çalışır.

## Sözleşme

`scripts/test-run-checks.mjs` keşif davranışını kilitler:

- diskteki her `scripts/test-*.mjs` dosyası çalıştırılabilir hedefler arasında olmalıdır;
- her çalıştırılabilir hedef aynı zamanda syntax kontrolünden geçmelidir;
- hedefler repo göreli, tekrarsız ve deterministik olmalıdır;
- runner kendini hedef olarak çağırmamalıdır.

## Kullanım

```
npm run check
```

`precheck` script'i kaldırıldı. npm `precheck` adını `check` öncesi otomatik lifecycle hook olarak çalıştırdığı için aynı takım iki kez yürütülüyordu; eski `precheck` zincirindeki tüm hedefler zaten keşif kapsamındadır.

## Canlı bağımlılık gerektiren testler

`scripts/test-redis-schedule-lease-live.mjs` `HAFIZE_TEST_REDIS_URL` tanımlı değilse kendini atlar ve `0` ile çıkar. Kapı bu davranışı korur; canlı Redis kapının ön koşulu değildir.
