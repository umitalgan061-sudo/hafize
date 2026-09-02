# Doğrulama kapısı (`npm run check`)

## Amaç

Depodaki tüm sözdizimi ve test kontrollerini **keşif yoluyla** çalıştırmak.
Önceki kurulumda `package.json` içinde elle bakımı yapılan uzun bir `&&`
zinciri vardı; yeni bir dosya eklendiğinde zincire yazılması unutulabiliyordu.
Bu nedenle 85 test süitinden 32'si hiç çalışmıyordu ve zincirin ortasındaki bir
hata kendisinden sonraki tüm süitlerin sessizce atlanmasına yol açıyordu.

## Ne çalışır?

`scripts/run-checks.mjs` her koşuda dizinleri tarar:

- **Sözdizimi:** `server.mjs`, `lib/*.mjs`, `scripts/*.mjs`, `public/*.js`
  (`node --check`).
- **Süitler:** `scripts/validate-agent-registry.mjs` ve tüm
  `scripts/test-*.mjs` dosyaları, alfabetik sırayla ve ayrı süreçlerde.

Yeni bir modül veya `test-*.mjs` dosyası eklemek kapıyı otomatik genişletir;
`package.json` düzenlemek gerekmez.

## Davranış

- İlk hatada durmaz. Tüm kontroller çalışır, başarısız olanların çıktısı sonda
  toplu olarak yazdırılır ve süreç `1` ile biter.
- Her süit için 120 sn (sözdizimi için 30 sn) zaman aşımı vardır; asılı kalan
  bir süit kapıyı süresiz bloke edemez.
- Süitler ayrı süreçlerde çalışır; biri global durum bozarsa diğerlerini
  etkilemez.

## Kullanım

```bash
npm run check                      # tam kapı (sözdizimi + tüm süitler)
npm run check:syntax               # yalnızca sözdizimi
node scripts/run-checks.mjs canva  # yalnızca adı "canva" içeren süitler
```

Filtre argümanları yalnızca süit seçimini daraltır; geliştirme sırasında hızlı
geri bildirim içindir. PR öncesi her zaman filtresiz `npm run check` çalıştırın.

## Geri alma

`scripts/run-checks.mjs` dosyasını silip `package.json` içindeki `check`
komutunu önceki `&&` zincirine döndürmek yeterlidir; başka modül bu dosyaya
bağımlı değildir.
