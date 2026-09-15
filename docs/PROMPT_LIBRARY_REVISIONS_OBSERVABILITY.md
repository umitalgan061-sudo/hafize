# Revision History Observability

## Local scope

Revision modülü sunucu telemetry üretmez. Gözlemlenebilirlik yalnız UI status ve local test yüzeyleri üzerinden yapılır.

## Success signals

Capture başarısı history count artışıyla doğrulanır. Restore sonrası ana prompt içeriği değişmiş ve history'de manual snapshot oluşmuş olmalıdır.

## Failure signals

Storage write false, prompt-not-found veya invalid-revision sonuçları kullanıcıya status mesajı olarak aktarılır.

## Debugging

Sorun tekrarında revision storage JSON'u export edilebilir. Export paylaşılmadan önce prompt metinleri redakte edilmelidir.

## Event tracing

Restore başarılı olduğunda core storage refresh event gönderilir. Amaç prompt listesi ve usage surface'inin aynı state'i görmesidir.

## No server logs

Revision içeriğini veya revision başlıklarını server loglarına taşımak tasarım gereği yoktur.

## PWA

Offline açılışta modül asset'inin shell cache'te bulunması temel sağlık göstergesidir.

## Browser errors

Storage exception'ları catch edilir. Uncaught exception gözlenmesi release blocker olarak değerlendirilir.

## Performance

10 revision ve 120 prompt üst sınırları gözlem testlerinin maksimum senaryosudur.

## Release verification

Kod değişiminden sonra PWA asset listesi, core event dispatch ve lifecycle cleanup testleri çalıştırılır.

## Support metadata

Support kaydına uygulama sürümü, browser, işletim sistemi, adım sırası ve hata mesajı eklenir. Ham prompt içeriği varsayılan olarak istenmez.

## Privacy

Analytics yokluğu bilinçli bir davranıştır ve product requirement'tır.
