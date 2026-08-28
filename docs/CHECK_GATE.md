# Check gate

`npm run check` Hafize'nin tek kalite kapısıdır. Kapı `scripts/run-checks.mjs`
tarafından yürütülür ve **elle tutulan dosya listesi içermez**.

## Ne çalışır

| Aşama | Kapsam |
| --- | --- |
| syntax | `server.mjs`, `lib/*.mjs`, `scripts/*.mjs`, `public/*.js` için `node --check` |
| tests | Diskte bulunan her `scripts/test-*.mjs` dosyası |

Keşif her çalıştırmada dizinden yapılır. Yeni bir modül veya yeni bir test
dosyası eklendiğinde kapıya ayrıca kayıt yapılması gerekmez; dosya diske
düştüğü anda kapsanır.

## Neden liste yok

Kapı daha önce `package.json` içinde ~10 KB'lık elle bakılan tek bir komut
zinciriydi. Yeni test dosyaları bu zincire eklenmediği için **85 test
dosyasından 32'si hiç çalışmıyordu** ve zincirdeki ilk hata sonrasındaki
adımlar da sessizce atlanıyordu. Keşif tabanlı kapı bu sınıf hatayı ortadan
kaldırır.

`scripts/test-check-gate.mjs` bu sözleşmeyi kilitler:

- keşfedilen test kümesi diskteki `scripts/test-*.mjs` kümesine birebir eşit
  olmalıdır (atlama listesi eklenemez);
- syntax kapsamı test kapsamının üst kümesi olmalıdır;
- `package.json` içindeki `check` komutu `scripts/run-checks.mjs`'e devretmeli
  ve dosya bazlı `node --check lib/...` zincirine geri dönmemelidir;
- bilinmeyen bir CLI argümanı hata verir; yazım hatası sessizce daraltılmış bir
  kapı çalıştıramaz.

## Kullanım

```bash
npm run check                              # tam kapı (syntax + tüm testler)
npm run check:syntax                       # yalnız syntax
node scripts/run-checks.mjs --filter gmail # yalnız eşleşen dosyalar
```

Her aşama `N/M passed` özeti yazar; başarısız dosyaların tam çıktısı ve sonunda
başarısız dosya listesi raporlanır. Herhangi bir başarısızlıkta çıkış kodu `1`
olur.

## Davranış notları

- Testler sıralı çalışır; geçici dosya kullanan testler birbirine karışmaz.
- Her test dosyası için 120 sn zaman aşımı vardır; asılı kalan bir test kapıyı
  süresiz bloke edemez.
- Dış servis gerektiren testler kendi ortam değişkenleri yoksa kendilerini
  atlar (örn. `HAFIZE_TEST_REDIS_URL` yoksa canlı Redis testi atlanır), bu
  yüzden kapının ayrı bir atlama listesine ihtiyacı yoktur.
- Eski `precheck` adımı kaldırıldı: içerdiği tarayıcı tarafı testler
  (`test-voice-input`, `test-voice-output`, `test-ui-shell`,
  `test-sidebar-accessibility`) zaten keşifle çalışıyor.
