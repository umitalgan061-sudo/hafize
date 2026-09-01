# Doğrulama kapısı (`npm run check`)

## Neden değişti

Kapı daha önce `package.json` içinde tek satırlık dev bir `&&` zinciriydi. İki
yapısal sorunu vardı:

- **Eksik kapsam.** Her yeni `lib/*.mjs` veya `scripts/test-*.mjs` dosyasının
  zincire elle eklenmesi gerekiyordu. Eklenmeyen dosya hiç çalıştırılmıyor ama
  kapı yine de yeşil görünüyordu.
- **Gizlenen hatalar.** `&&` ilk hatada duruyordu; o hatanın arkasındaki tüm
  hedefler çalıştırılmadan kalıyordu.

Bu iki sorun gerçek regresyonları saklamıştı: `scripts/test-tool-runtime.mjs`
eski üç araçlık listeyi bekliyordu (Canva ve Gmail read araçları eklendiğinden
beri kırmızıydı) ve arkasında duran `scripts/test-gmail-read-client.mjs`
`INVALID_GMAIL_READ` yerine ham `TypeError` alıyordu.

## Nasıl çalışıyor

`scripts/run-checks.mjs` hedefleri diskten keşfeder:

- **Syntax:** `server.mjs`, `lib/*.mjs`, `scripts/*.mjs`, `public/*.js` için
  `node --check`.
- **Çalıştırma:** `scripts/validate-agent-registry.mjs` ve tüm
  `scripts/test-*.mjs` betikleri.

Kapı ilk hatada durmaz; tüm hedefleri çalıştırır, sonunda başarısız olanların
listesini ve her birinin son 20 satırlık çıktısını basar. Tek bir hedef bile
kırmızıysa çıkış kodu `1` olur. Her hedefin 120 saniyelik zaman aşımı vardır;
takılan bir betik kapıyı süresiz bekletmez.

### Filtre

Argümanlar dosya yolunda alt dize olarak eşleşir:

```
node scripts/run-checks.mjs gmail          # yalnız gmail hedefleri
node scripts/run-checks.mjs voice ui-shell # birden çok filtre = birleşim
```

`npm run precheck` bu filtrenin frontend alt kümesidir (voice, ui-shell,
sidebar-accessibility); ayrı bir doğrulama sistemi değildir, aynı çalıştırıcıyı
kullanır.

## Bakım kuralı

Yeni bir test için `package.json` düzenlenmez. `scripts/test-<konu>.mjs` adıyla
dosya eklemek kapıya dahil olmak için yeterlidir. Bir betiğin kapı dışında
kalması isteniyorsa adı `test-` ile başlamamalıdır.
