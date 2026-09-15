# Yerel Veri Merkezi — Privacy Review

## Purpose limitation

Panel yalnız kullanıcının cihazındaki bilinen Hafize state'ini yönetmek için vardır. Yeni bir data collection amacı eklemez.

## Data minimization

Ham içerik UI'ya yalnız mevcut feature satırlarının ihtiyaç duyduğu metadata sınırında açılır. Manifest ham içerik taşımaz.

## Storage scope

Yalnız explicit allowlist key'leri yönetilir. Browser cookie, credential ve cross-origin storage kapsam dışıdır.

## User control

Inspection pasif okunur. Delete, bulk delete ve clear-all explicit action ve confirmation gerektirir.

## Transparency

Panel hangi alanların yönetildiğini, approximate size ve state bilgisini açıkça gösterir. Unknown key'ler ayrıca belirtilir.

## Retention

Data center mevcut feature retention sözleşmelerini değiştirmez.

## Export

Manifest metadata-only olduğu için diagnostic export ile content backup ayrımı korunur.

## Future changes

Remote synchronization veya account-linked analytics ayrı privacy review gerektirir; bu modüle sessizce eklenmemelidir.
