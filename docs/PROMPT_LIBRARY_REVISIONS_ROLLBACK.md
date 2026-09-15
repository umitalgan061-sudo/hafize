# Revision History Rollback

## Kod rollback

Revision feature ayrı script olarak yüklenir. Release revert edildiğinde `public/prompt-library-revisions.js` ve ona ait loader/cache değişiklikleri birlikte geri alınır.

## Veri rollback

Revision storage otomatik olarak silinmez. Kod rollback sonrası kayıtların tutulması, sonraki uyumlu sürümün onları okuyabilmesi için tercih edilir.

## Yanlış restore

Yanlış bir revision restore edilirse mevcut durum restore öncesinde manual snapshot olarak alınmış olmalıdır. History tekrar açılıp bir önceki manual kayıt geri yüklenebilir.

## Bozuk storage

JSON parse edilemiyorsa modül boş store ile açılır. Ana prompt storage'ına müdahale edilmez.

## Quota failure

Storage yazılamıyorsa işlem başarısız bildirilir. Eski revision listesi overwrite edilmeden önce write başarısız olur; kullanıcı mevcut prompt'u kaybetmemelidir.

## PWA rollback

Cache version feature öncesi sürüme döndürülür. Eski cache service worker tarafından temizlenebilir; revision storage cihazda kalır.

## Support

Support kaydı; tarayıcı, uygulama sürümü, adım sırası, history sayısı ve mümkünse redacted export bilgisi içermelidir. Ham prompt içeriği gereksiz yere paylaşılmamalıdır.

## Verification

Rollback sonrası Prompt Library create/edit/use akışları, usage stats ve smart-fill fonksiyonlarının çalıştığı doğrulanır.
