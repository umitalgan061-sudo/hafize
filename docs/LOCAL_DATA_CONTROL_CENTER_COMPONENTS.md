# Yerel Veri Merkezi — Bileşenler

## Core

`local-data-center.js` registry, inspect, clear ve manifest davranışının kaynağıdır.

## Insights

`local-data-center-insights.js` grouped byte ve presence özetini üretir. Yeni storage okumaz; core snapshot'ını çağırır.

## Filters

`local-data-center-filters.js` metadata üzerinde arama ve kategori görünürlüğü sağlar. Storage mutation yapmaz.

## Audit

`local-data-center-audit.js` her alanın empty/valid/invalid/truncated/unavailable durumunu gösterir.

## Bulk

`local-data-center-bulk.js` en fazla 8 alanı tek confirmation ile temizler.

## Sort

`local-data-center-sort.js` registry, size, name ve audit state sıralaması sağlar.

## CSS

Her alt yüzeyin küçük ve scoped CSS dosyası vardır. Global shell selector'larını değiştirmez.

## Isolation

Her controller API ve DOM yokluğunda mount olmaz. Destroy fonksiyonları listener ve observer cleanup yapar.
