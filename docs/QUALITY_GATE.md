# Kalite Kapısı (`npm run check`)

Hafize'nin tüm statik ve smoke doğrulaması tek bir çalıştırıcıda toplanır:
`scripts/run-checks.mjs`. Ek bağımlılık kullanmaz.

```bash
npm run check                                 # tüm kapı (syntax + test)
npm run precheck                              # yalnızca ses/UI alt kümesi
node scripts/run-checks.mjs --list            # çalıştırmadan planı yazdır
node scripts/run-checks.mjs --filter=gmail    # yalnızca eşleşen adımlar
```

## Ne yapar

1. **Syntax kapısı** — `server.mjs`, `lib/*.mjs`, `public/*.js` ve
   `scripts/*.mjs` altındaki her dosyayı `node --check` ile tarar.
2. **Test kapısı** — `scripts/validate-agent-registry.mjs` ve
   `scripts/test-*.mjs` altındaki her test dosyasını çalıştırır.

Her iki liste de **diskten otomatik keşfedilir**; elle bakımı yapılan bir
dosya listesi yoktur. Yeni bir `scripts/test-*.mjs` eklemek onu kapıya
bağlamak için yeterlidir.

## Neden bu tasarım

Kapı daha önce `package.json` içinde elle bakımı yapılan uzun bir `&&`
zinciriydi. Bu iki somut arızaya yol açtı:

- **Sessiz atlanan testler.** Zincire eklenmeyi unutulan test dosyaları hiç
  çalışmıyordu. Bir noktada 85 test dosyasının 32'si (%38) kapının dışındaydı —
  OAuth, PKCE ve token şifreleme testlerinin tamamı dahil.
- **Gizlenen hatalar.** `&&` ilk hatada durduğu için zincirin başındaki tek bir
  kırmızı test, arkasındaki ~80 testi görünmez yapıyordu.

Çalıştırıcı ikisini de kapatır: keşif birincisini, "hepsini çalıştır ve sonunda
topluca raporla" davranışı ikincisini önler. Başarısız adımlar hem satır satır
(`✗ <dosya>`) hem de sonunda tam çıktılarıyla listelenir; herhangi bir adım
başarısızsa çıkış kodu `1` olur.

## Sözleşme testi

`scripts/test-run-checks.mjs` kapının kendisini doğrular: diskteki her test
dosyasının ve her çalıştırılabilir kaynağın plana girdiğini, filtrenin planı
daralttığını ve eşleşmeyen bir filtrenin sessizce yeşil dönmek yerine hata
verdiğini kontrol eder. Bu test, "yeni test kapıya bağlanmadı" regresyonunun
tekrarlamasını engeller.

## Bilinen atlamalar

- `scripts/test-redis-schedule-lease-live.mjs` canlı bir Redis örneği ister ve
  `HAFIZE_TEST_REDIS_URL` tanımlı değilse kendini atlar (çıkış kodu `0`).
