# Doğrulama kapısı (`npm run check`)

## Amaç

Hafize'nin tüm statik ve smoke doğrulaması tek bir giriş noktasından çalışır:

```
npm run check
```

Bu komut `scripts/run-checks.mjs` runner'ını çağırır.

## Neden runner'a geçildi

Kapı daha önce `package.json` içinde elle bakımlı, tek satırlık uzun bir
`node --check ... && node scripts/... && ...` zinciriydi. Yeni bir test dosyası
eklendiğinde bu zincire eklenmesi unutulabiliyordu ve test hiçbir zaman
çalışmadan repoda duruyordu. Bu sessiz boşluk gerçek bir hata gizledi:
`lib/gmail-read-client.mjs` ve `lib/canva-read-client.mjs` içindeki
`read(null)` çağrısı, sözleşmenin öngördüğü `INVALID_*_READ` hatası yerine ham
`TypeError` fırlatıyordu.

## Runner sözleşmesi

- **Söz dizimi kontrolü:** `server.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve
  `public/*.js` dosyalarının tamamı `node --check` ile taranır. Yeni dosya
  otomatik kapsama girer.
- **Test keşfi:** `scripts/test-*.mjs` kalıbına uyan her dosya çalıştırılır.
  Yeni test eklemek için başka hiçbir yeri güncellemek gerekmez.
- **Registry doğrulaması:** `scripts/validate-*.mjs` dosyaları testlerden önce
  çalışır.
- **Atlama yalnızca açık gerekçeyle:** Bir test ancak `run-checks.mjs`
  içindeki `SKIPPED_TESTS` haritasında gerekçesiyle listelenirse atlanır ve
  çıktıda `skip` satırı olarak görünür. Şu an tek istisna canlı Redis sunucusu
  gerektiren `test-redis-schedule-lease-live.mjs` dosyasıdır.
- **Tam rapor:** Runner ilk hatada durmaz; tüm testleri çalıştırıp başarısız
  olanların çıktısını sonda toplu gösterir ve exit code 1 döner.

## Yeni test eklerken

1. `scripts/test-<konu>.mjs` dosyasını oluştur.
2. Test başarılıysa tek satırlık bir özet `console.log` yaz; runner bu satırı
   `ok` raporunda gösterir.
3. `npm run check` çalıştır. Başka kayıt adımı yoktur.
