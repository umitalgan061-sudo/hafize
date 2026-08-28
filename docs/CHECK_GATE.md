# Doğrulama Kapısı (`npm run check`)

## Amaç

Her self-development turu, değişikliği göndermeden önce tek bir komutla
doğrulanabilmelidir. Kapı `scripts/run-checks.mjs` tarafından yürütülür.

```bash
npm run check   # veya: npm test
```

## Ne çalışır?

Adımlar elle listelenmez, dosya sisteminden keşfedilir:

1. **Syntax kontrolü** — `server.mjs`, `lib/*.mjs`, `public/*.js` ve
   `scripts/*.mjs` dosyalarının tamamı için `node --check`.
2. **Ajan kaydı doğrulaması** — `scripts/validate-agent-registry.mjs`.
3. **Testler** — `scripts/test-*.mjs` kalıbına uyan her dosya, alfabetik
   sırayla ve ayrı bir Node süreci içinde.

Sonunda `check özeti: <geçen>/<toplam> adım geçti` satırı yazılır.

## Neden keşif tabanlı?

Kapı daha önce `package.json` içinde elle bakımı yapılan uzun bir `&&`
zinciriydi. Bunun iki somut sonucu oldu:

- **Sessiz kapsam kaybı.** 85 test dosyasının 33'ü zincire hiç eklenmemişti;
  yani suite'in üçte biri hiç çalışmıyordu.
- **Maskelenen hata.** `&&` ilk hatada durduğu için `test-tool-runtime.mjs`
  başarısızlığı, arkasındaki `test-gmail-read-client.mjs` başarısızlığını
  gizliyordu.

Keşif tabanlı runner her iki sorunu da yapısal olarak çözer: yeni bir test
dosyası eklendiğinde kapıya bağlanması unutulamaz ve tüm adımlar çalıştırılıp
başarısızlıkların tamamı tek seferde raporlanır.

## Davranış kuralları

- Runner **tüm** adımları çalıştırır; ilk hatada durmaz.
- Her adım ayrı süreçte, 180 sn zaman aşımıyla çalışır; asılı kalan bir test
  kapıyı süresiz bloke edemez.
- Başarısız veya zaman aşımına uğrayan adımların çıktısı özetin ardından
  `--- <adım> ---` başlıklarıyla yazdırılır.
- En az bir başarısızlıkta çıkış kodu `1`'dir.
- `scripts/test-*.mjs` dosyası bulunamazsa kapı hata verir; yanlışlıkla boş
  bir suite yeşil görünmez.

## Yeni test eklemek

`scripts/` altına `test-<konu>.mjs` adıyla bir dosya ekleyin. Test başarılıysa
sıfır çıkış kodu döndürmeli, başarısızsa `throw`/`assert` ile sıfırdan farklı
kodla çıkmalıdır. `package.json` düzenlemesi gerekmez.

Testler ağ, canlı servis veya gerçek kimlik bilgisi gerektirmemelidir; harici
bağımlılık gerektiren senaryolar (örneğin canlı Redis) yapılandırma yokken
kendini atlayacak şekilde yazılır.
