# Koleksiyon Kod İnceleme Kriterleri

## Mimari

Tek collection module, tek keyboard module ve tek CSS dosyası kullanılmalıdır.

Prompt core içine duplicate collection logic eklenmemelidir.

## Veri

Normalize edilmiş collection nesnesi immutable tutulur.

Assignment map düz ve bounded olmalıdır.

Counts türetilmiş olmalı, ayrı state ile drift yaratmamalıdır.

## UI

Collection selector prompt satırına mutation sonrası yeniden eklenebilir olmalıdır.

Dynamic text HTML parser üzerinden verilmemelidir.

## Lifecycle

MutationObserver disconnect edilebilir olmalıdır.

Root event listener'ları destroy sırasında kaldırılmalıdır.

Dinamik satır listener'ları eski DOM düğümlerine gereksiz referans oluşturmamalıdır.

## Import

Mevcut veriyi destructive olarak değiştiren akış bulunmamalıdır.

Duplicate isim ve ID durumları deterministik şekilde işlenmelidir.

## Default

Default assignment yalnızca yeni prompt ID tespit edildiğinde çalışmalıdır.

## PWA

Her yeni public asset index ve service worker ile birlikte düşünülmelidir.

## Test

Source, data shape, import/export, a11y, security, lifecycle, keyboard ve PWA için ayrı regression sözleşmeleri olmalıdır.
