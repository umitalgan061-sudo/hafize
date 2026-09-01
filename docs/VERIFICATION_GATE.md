# Doğrulama kapısı (`npm run check`)

Durum: uygulandı — `scripts/run-checks.mjs`.

## Neden değişti

Kapı daha önce `package.json` içinde elle bakımlı tek bir `&&` zinciriydi. Bu yaklaşımın iki yapısal sorunu vardı:

1. **Sessiz kapsam kaybı.** Yeni test veya `lib/` modülü eklendiğinde zincire elle eklenmezse kapı onu hiç çalıştırmıyordu. Bu belgenin yazıldığı anda 86 test scriptinden 32'si ve 27 `lib/` dosyası kapının tamamen dışındaydı.
2. **İlk hatada durma.** `&&` zinciri ilk başarısızlıkta duruyordu; arkasındaki gerçek hatalar görünmüyordu. Kapı kırmızıyken bu, tek bir turda tüm hasarın görülmesini engelliyordu.

## Sözleşme

- Hedefler **keşifle** bulunur, elle listelenmez:
  - sözdizimi (`node --check`): `server.mjs`, `lib/*.{mjs,js}`, `scripts/*.{mjs,js}`, `public/*.{mjs,js}`;
  - çalıştırma: `scripts/test-*.mjs` ve `scripts/validate-*.mjs`.
- Runner kendini (`scripts/run-checks.mjs`) test olarak çalıştırmaz.
- **Tüm** hedefler çalıştırılır; ilk hatada durulmaz. Özet ve tüm başarısızlıkların çıktısı sonda birlikte raporlanır.
- Herhangi bir başarısızlıkta çıkış kodu `1`, tamamen temizse `0`.
- Her test için 120 saniyelik timeout vardır; asılı kalan bir test kapıyı süresiz bloke edemez.
- Dış kaynak isteyen testler kendi içlerinde atlanır (örn. `test-redis-schedule-lease-live.mjs`, `HAFIZE_TEST_REDIS_URL` yoksa `0` ile çıkar). Runner'da ayrı bir atlama listesi tutulmaz; atlama kararı testin kendi sözleşmesidir.

## Kullanım

```
npm run check   # veya: npm test
```

## Doğrulama

Kapının gerçekten kırmızıya düşebildiği, kasıtlı olarak bozulmuş bir test ve bozuk sözdizimli geçici bir `lib/` dosyasıyla doğrulandı: her ikisi de raporlandı ve çıkış kodu `1` oldu. Her zaman yeşil kalan bir kapı, kapı olmamasından daha kötüdür.

## Geri alma

`package.json` içindeki `check` script'i eski `&&` zincirine döndürülür ve `scripts/run-checks.mjs` silinir. Kapının kapsamı o noktada yeniden daralır.
