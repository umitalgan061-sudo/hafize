# Doğrulama koşucusu (`npm run check`)

## Neden

`package.json` içindeki `check` ve `precheck` script'leri elle bakımı yapılan
tek satırlık uzun `&&` zincirleriydi. Yeni bir test dosyası eklendiğinde zincire
yazılması unutulabiliyordu ve unutulan test sessizce hiç çalışmıyordu.

Bu sessiz boşluk ölçüldü: depoda **32 test dosyası** zincire hiç eklenmemişti.
Aralarında `test-canva-read-client.mjs` de vardı ve bu dosya, `lib/canva-read-client.mjs`
içinde `lib/gmail-read-client.mjs` ile birebir aynı olan bir giriş doğrulama
hatasını yakalayabilecek durumdaydı.

## Ne yapar

`scripts/run-checks.mjs` zinciri elle yazmak yerine dosyaları keşfeder:

1. **Syntax** — `server.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve `public/*.js`
   dosyalarının tümü `node --check` ile doğrulanır.
2. **Agent registry** — `scripts/validate-agent-registry.mjs` çalıştırılır.
3. **Testler** — `scripts/test-*.mjs` kalıbına uyan her dosya ayrı bir Node
   sürecinde çalıştırılır.

Keşif otomatik olduğu için yeni bir `scripts/test-*.mjs` dosyası eklemek onu
doğrulamaya dahil etmeye yeter; ayrıca `package.json` düzenlemek gerekmez.

## Davranış

- Test'ler ilk hatada durmaz; hepsi çalışır ve sonda tek bir başarısızlık özeti
  yazılır. Böylece tek turda birden çok kırık test görülebilir.
- Başarılı testin yalnızca son satırı (kendi özet çıktısı) gösterilir; başarısız
  testin tam stdout/stderr çıktısı girintili olarak basılır.
- Herhangi bir syntax, registry veya test hatası varsa süreç `1` ile çıkar.
- Canlı servis gerektiren testler kendi içinde atlanır. Örneğin
  `test-redis-schedule-lease-live.mjs`, `HAFIZE_TEST_REDIS_URL` tanımlı değilse
  atlandığını yazıp başarıyla döner; koşucu bu kararı değiştirmez.

## Kullanım

```
npm run check   # tümü: syntax + registry + testler
npm test        # aynı komut
```

Önceki `precheck` script'i kaldırıldı: içerdiği voice-input, voice-output,
ui-shell ve sidebar-accessibility testleri `scripts/test-*.mjs` kalıbına uyduğu
için artık `check` tarafından zaten çalıştırılıyor. Aynı işi yapan ikinci bir
zincir tutulmaz.

## Geri alma

`scripts/run-checks.mjs` dosyasını silip `package.json` içindeki `check` ve
`precheck` script'lerini önceki `&&` zincirine döndürmek yeterlidir. Koşucu
başka hiçbir modül tarafından import edilmez.
