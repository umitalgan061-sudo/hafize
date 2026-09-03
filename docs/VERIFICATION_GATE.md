# Doğrulama Kapısı

## Amaç

`npm run check` deponun tek doğrulama kapısıdır. Test dosyalarını `package.json`
içinde elle listelemek yerine diskten keşfeder.

## Neden değişti?

Kapı daha önce `package.json` içinde tek satırlık, elle bakımı yapılan ~6 KB'lık
bir komut zinciriydi. Bu iki somut soruna yol açtı:

1. **Yetim testler.** 86 test betiğinin 32'si (%37) hiçbir kapıya bağlı değildi;
   aralarında OAuth token, PKCE ve şifreleme testlerinin tamamı vardı. Yeni bir
   test eklemek, onu zincire de eklemeyi hatırlamayı gerektiriyordu.
2. **Maskelenen hatalar.** `&&` ile zincirlenmiş komutlar ilk başarısızlıkta
   durur, bu yüzden sonraki başarısızlıklar görünmez kalır.

## Nasıl çalışır?

Kapı iki aşamalıdır:

1. **Sözdizimi** — `server.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve `public/*.js`
   dosyalarının tamamı `node --check` ile ayrıştırılır (çalıştırılmaz).
2. **Testler** — `scripts/test-*.mjs` ve `scripts/validate-*.mjs` betiklerinin
   her biri kendi alt sürecinde, yalıtılmış biçimde ve 120 sn zaman aşımıyla
   çalıştırılır.

Tüm başarısızlıklar toplanır ve çalışma sonunda birlikte raporlanır; kapı ilk
hatada durmaz. Herhangi bir başarısızlıkta çıkış kodu `1` olur.

## Komutlar

| Komut | Kapsam |
| --- | --- |
| `npm run check` | Sözdizimi + tüm testler (tam kapı) |
| `npm test` | `check` ile aynı |
| `npm run precheck` | Sözdizimi + yalnızca UI/ses/erişilebilirlik testleri (hızlı alt küme) |
| `node scripts/run-all-tests.mjs <filtre>` | Adı filtreyle eşleşen testler |

Filtre argümanları dosya adına göre alt dize eşleşmesidir; örneğin
`node scripts/run-all-tests.mjs oauth gmail` yalnızca ilgili betikleri çalıştırır.

## Yeni test eklerken

`scripts/` altına `test-` önekiyle bir `.mjs` dosyası eklemek yeterlidir; kapı
onu bir sonraki çalıştırmada kendiliğinden bulur. `package.json` düzenlenmez.

## Bilinen davranış

`scripts/test-redis-schedule-lease-live.mjs` gerçek bir Redis örneği ister.
`HAFIZE_TEST_REDIS_URL` tanımlı değilse test kendini atlar ve `0` ile çıkar; bu
yüzden kapı varsayılan ortamda da yeşil kalır.

## Geri alma

`package.json` içindeki `scripts` bloğunu önceki elle listelenmiş haline
döndürmek ve `scripts/run-all-tests.mjs` dosyasını silmek yeterlidir; kaynak
kodda başka bağımlılık oluşmaz.
