# Composer Ekleri — Test Rehberi

## Source tests
Source contract paketleri static dosya sınırlarını kontrol eder.

## VM behavior
Policy ve secret scanner Node vm içinde gerçek fonksiyon çağrılarıyla doğrulanabilir.

## UI manual
Panel, range, preview, selection, insert, undo, copy ve quick actions browser'da manuel doğrulanır.

## Security manual
Dosya seçimi öncesinde network logu, riskli content confirm ve storage absence kontrol edilir.

## PWA manual
Offline shell açıldığında attachment static assetleri yüklenmelidir. API endpointleri network-only kalır.

## Accessibility manual
Keyboard only, screen reader, reduced motion ve forced colors kombinasyonları kontrol edilir.

## Release command
npm run check; ardından feature testlerinin isimleri run-checks keşfiyle doğrulanır.

## Failure reporting
Yerel tam suite çalıştırılmadıysa bunu PR açıklamasında saklamamak gerekir.