# Kalite kapısı (`npm run check`)

## Sorun

Kapı, `package.json` içinde elle bakımı yapılan tek satırlık uzun bir `&&`
zinciriydi. Yeni bir `lib/` modülü veya `scripts/test-*.mjs` dosyası eklendiğinde
zinciri güncellemek unutulabiliyordu ve dosya sessizce kapının dışında kalıyordu.

Bu, gerçek regresyonların fark edilmemesine yol açtı: 85 test dosyasının 32'si
(tüm OAuth, PKCE, token şifreleme ve connector read-client testleri dahil) hiç
çalıştırılmıyordu.

## Çözüm

`scripts/run-checks.mjs` kontrol hedeflerini diskten keşfeder:

- `server.mjs` ile `lib/`, `scripts/`, `public/` altındaki tüm `.mjs` / `.js`
  dosyaları için `node --check` (paralel, yan etkisiz);
- `scripts/validate-agent-registry.mjs`;
- `scripts/test-*.mjs` dosyalarının tamamı, sırayla.

Testler sırayla çalışır çünkü bazıları geçici dosya ve ortam değişkeni paylaşır.
Herhangi bir adım başarısız olursa çıkış kodu `1` olur ve yalnızca başarısız
adımların çıktısı raporun sonunda toplu olarak yazdırılır.

## Dış bağımlılık gerektiren testler

`scripts/test-redis-schedule-lease-live.mjs` canlı bir Redis sunucusu ister.
Varsayılan çalıştırmada atlanır ve atlandığı raporda açıkça belirtilir. Çalışan
bir Redis varken şu komutla dahil edilir:

```
npm run check:redis-live
```

## Sözleşme

- Yeni bir test dosyası `scripts/test-*.mjs` adlandırmasını kullandığı sürece
  kapıya otomatik dahil olur; `package.json` güncellemek gerekmez.
- Bir test yalnız `run-checks.mjs` içindeki `OPT_IN_TESTS` listesine açık bir
  ortam değişkeni kapısıyla eklenerek atlanabilir; sessiz atlama yoktur.
- Atlanan test sayısı her çalıştırmada raporlanır.

## Geri alma

`package.json` içindeki `check` betiği eski `&&` zincirine döndürülür ve
`scripts/run-checks.mjs` silinir. Kapı dışındaki hiçbir çalışma zamanı davranışı
bu dosyalara bağlı değildir.
