# Yerel Veri Merkezi — Review

## Mimari

Data center yalnız storage registry üzerinden çalışır ve feature-specific migration yapmaz. Yönetim katmanı ile veri sahibi feature'lar ayrıdır.

## Güvenlik

Allowlist, bounded read, safe DOM rendering ve explicit confirmation birlikte incelenmelidir. `removeItem` yalnız bilinen key'ler için çağrılabilir.

## Mahremiyet

Manifest içerik içermez. Network ve telemetry yoktur. Unknown key'ler korunur.

## UX

Boş durum, unavailable durum ve temizleme başarısı birbirinden ayrıdır. Kullanıcı hangi alanı sildiğini açıkça görür.

## Accessibility

Native controls, semantic headings, list roles, live status ve focus-visible değerlendirilir.

## PWA

Yeni static asset cache listesinde ve yeni cache version ile yayınlanmalıdır.

## Regression

Existing settings workspace ile duplicate mount, cross-tab refresh ve destroy davranışları incelenmelidir.

## Release gate

3.000 değişen satır hard cap aşılmamalı; test koşumu gerçek sonuçla raporlanmalıdır.
