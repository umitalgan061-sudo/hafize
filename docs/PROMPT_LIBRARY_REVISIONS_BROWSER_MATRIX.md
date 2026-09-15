# Revision History Browser Matrix

## Chromium tabanlı tarayıcılar

Beklenen: localStorage, DOM dialog, Blob download, StorageEvent ve MutationObserver desteklenir. Revision paneli tam işlevli çalışır.

## Firefox

Beklenen: aynı temel Web API'ler kullanılabildiği için panel, local storage ve export davranışı aynı olmalıdır.

## Safari

Beklenen: localStorage ve Blob desteklenir. StorageEvent constructor davranışı farklılık gösterebileceği için kod fallback içerir.

## Mobil web

Panel viewport yüksekliğini aşmamalı, footer düğmeleri satır kırmalıdır. Preview scroll edilebilir kalmalıdır.

## PWA standalone

Revision scripti shell cache'te bulunduğu için uygulama ağ olmadan açıldığında modül dosyası mevcut olmalıdır.

## Private browsing

Storage quota veya erişim hatası mümkün olabilir. Modül exception atmadan boş/failure durumu göstermelidir.

## Reduced motion

CSS `prefers-reduced-motion` ile panel içi scroll davranışı animasyonsuz tutulur.

## Forced colors

Panel, satır ve focus göstergeleri Windows High Contrast benzeri modlarda görünür kalmalıdır.

## Input method

Revision işlemlerinde klavye kullanımı fareye alternatif olmalıdır. Escape kapanma ve Tab döngüsü korunur.

## Manual verification

Release öncesi en az bir desktop Chromium ve bir mobil Safari/Chromium ortamında açma, restore ve export manuel doğrulanır.
