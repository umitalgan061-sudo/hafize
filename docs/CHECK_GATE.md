# Kontrol kapısı (check gate)

Hafize'nin tek doğrulama girişi `npm run check` (eş anlamlısı `npm test`) ve
onun arkasındaki `scripts/run-checks.mjs` koşucusudur.

## Koşucu ne yapar?

1. **Syntax kontrolü** — kök dizindeki `*.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve
   `public/*.js` dosyalarının tamamı `node --check` ile taranır.
2. **Prelude** — `scripts/validate-agent-registry.mjs` her zaman ilk çalışır.
3. **Test paketleri** — `scripts/test-*.mjs` dosyalarının tamamı ayrı süreçte,
   en fazla 4 eşzamanlı ve paket başına 120 sn zaman aşımı ile çalıştırılır.

İlk hatada durulmaz; tüm paketler çalışır ve başarısız olanların son 40 satırı
özet olarak yazdırılır. Çıkış kodu yalnız hiç başarısızlık yoksa 0'dır.

## Neden otomatik keşif?

Kapı daha önce package.json içinde 8 KB'lık tek satırlık bir shell zinciriydi.
Yeni test dosyaları bu zincire eklenmediği için 85 paketin 32'si — tüm OAuth,
PKCE, token şifreleme, personal memory runtime, screen-share ve hands-free
paketleri dahil — hiç çalışmıyordu ve kapı fark edilmeden kırmızıya düşmüştü.

Otomatik keşif bu kaymayı yapısal olarak engeller: `scripts/` altına eklenen
her `test-*.mjs` dosyası bir sonraki koşuda kendiliğinden kapıya girer.
`scripts/test-run-checks.mjs` bu sözleşmeyi kilitler ve package.json içinde
tek tek test dosyası adı geçmesini reddeder.

## Kullanım

```bash
npm run check                          # tüm kapı (~10 sn)
node scripts/run-checks.mjs --list     # çalıştırılacak paketleri listele
node scripts/run-checks.mjs --filter gmail   # yalnız eşleşen paketler
```

`--filter` geliştirme sırasında dar döngü içindir; PR öncesi her zaman filtresiz
tam kapı çalıştırılır.

## Yeni test eklerken

- Dosya adı `scripts/test-<konu>.mjs` olmalıdır.
- Paket ağ, canlı servis veya kullanıcı girdisi gerektirmemeli; gerekli
  bağımlılık yoksa (örneğin Redis) paket kendi içinde güvenli biçimde
  atlanmalı ve 0 ile çıkmalıdır.
- Paket başarıda tek satırlık bir özet yazdırır; kapı çıktısı bu satırlarla
  okunabilir kalır.
