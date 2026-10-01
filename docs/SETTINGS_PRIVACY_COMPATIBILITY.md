# Gizlilik Merkezi Uyumluluk

## Storage API

Modül standart localStorage getItem/key/removeItem sözleşmesine dayanır. Erişim yoksa güvenli fallback kullanır.

## Browser storage estimate

`navigator.storage.estimate()` opsiyoneldir. Desteklenmediğinde UI kota değerini bilinmiyor olarak gösterir.

## Clipboard

Privacy report kopyalama eylemi Clipboard API'ye bağlı değildir; API yoksa hata mesajı gösterilir.

## PWA

Assetler Service Worker shell listesine alınır. API yolları network-only olmaya devam eder.

## Existing workspaces

Panel Settings Workspace'in içine eklenir ve diğer workspace'lerin localStorage sözleşmesini değiştirmez.

## Unknown keys

Üçüncü parti veya gelecekteki özelliklere ait bilinmeyen alanlar korunur. Bu davranış backward/forward compatibility açısından bilinçli bir tercihtir.

## Future surfaces

Yeni bir yüzey explicit allowlist entry olmadan temizlenemez. Bu nedenle yeni feature kendi storage anahtarını eklediğinde privacy center'a da entegrasyon yapılmalıdır.
