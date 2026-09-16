# Schedule Edit Compatibility

Mevcut schedule schema versionı `1` olarak kalır.

GET/POST/DELETE endpointleri değişmeden çalışır; PATCH yalnız yeni update yüzeyidir.

Worker `claimDue`, `complete`, `fail` ve `defer` davranışlarını değiştirmez.

Encrypted file adapter aynı persistence envelope'ını kullanır.

Redis lease runtime'ı update için ayrı bir bağlantı istemez.

Eski schedule kayıtları migrate edilmeden açılabilir.

Client olmayan API tüketicileri PATCH kullanmadıkları sürece davranış değişikliği yaşamaz.

UI feature PWA shell asset'leriyle birlikte paketlenir; API cache'e alınmaz.
