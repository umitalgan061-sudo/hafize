# Yerel Veri Merkezi — Geliştirici Rehberi

## Registry eklemek

Yeni bir storage alanı önce feature sahibi tarafından tanımlanır. Sensitivity, retention, clear ve migration davranışı belirlendikten sonra registry'ye eklenir.

## Descriptor

`id` UI ve testlerde sabit kimliktir. `key` storage adresidir. `label` ve `description` kullanıcıya görünür. `clearGroup` filtre ve analytics olmayan local summary gruplaması için kullanılır.

## Read path

Tüm okumalar `inspectStore` üzerinden bounded `safeGet` kullanır. Yeni kodun doğrudan `localStorage.getItem` çağırarak sınırı bypass etmesi yasaktır.

## Write path

Controller sadece clear fonksiyonları üzerinden storage siler. Yeni write davranışı data center'a eklenmemelidir; data owner feature'a aittir.

## Render path

Dynamic text `textContent` ile yazılır. HTML string interpolation kullanılmaz.

## Extension modules

Insights, filters, audit, bulk ve sort modülleri ana registry'yi tüketir; kendi key listelerini kopyalamamalıdır.

## Test

Her yeni registry key için policy, clear, bounds ve privacy testinin güncellenmesi gerekir.

## Release

PWA shell asset listesi güncellenmeden yeni static module yayınlanmaz.
