# Zamanlanmış Görevler — Rollback

## Rollback ilkesi

Scheduled Tasks UI bir client yüzeyidir; rollback sırasında server schedule kayıtları korunmalıdır.

UI rollback, kullanıcının oluşturduğu veya worker tarafından yürütülen schedule verisini silme işlemi değildir.

## Ne zaman rollback

Client syntax hatası.

Critical security regression.

Yanlış endpoint kullanımı.

PWA cache regression.

Accessibility blocker.

Beklenmeyen scheduler load.

## Rollback kapsamı

Şu dosyalar birlikte geri alınır:

`public/scheduled-tasks.js`

`public/scheduled-tasks.css`

`public/scheduled-tasks-enhancements.js`

`public/scheduled-tasks-keyboard.js`

`public/index.html` schedule asset referansları.

`public/sw-policy.js` schedule asset ve cache version değişikliği.

Test ve docs dosyaları kod rollback'una eşlik eder.

## Data preservation

Server schedule storage değiştirilmez.

Encrypted durable storage dosyası silinmez.

Redis lease state'i manuel temizlenmez.

Worker runtime durdurulması ayrı operasyon kararıdır.

## Cache rollback

Service worker yeni cache version ürettiği için rollback sonrası uygun version yayınlanmalıdır.

Eski cache'ler prefix politikasına göre temizlenebilir.

API responses schedule verisi olarak cache içinde bulunmamalıdır.

## Kullanıcı etkisi

Rollback sonrasında Görevler menüsü tekrar disabled olabilir veya UI tamamen kaldırılabilir.

Daha önce planlanmış işler backend worker üzerinden yürümeye devam edebilir; client UI'nin kaldırılması server schedule'ları iptal etmez.

Bu ayrım release notunda açıkça belirtilmelidir.

## Safe revert sequence

1. PR revert hazırla.
2. Diff ve status kontrol et.
3. Schedule API ownership testlerini tekrar çalıştır.
4. Service worker asset listesini doğrula.
5. Main ref'in beklenen commit'e geldiğini kontrol et.
6. Server schedule storage'a dokunma.

## Partial rollback

UI CSS rollback edilirse JS'in aynı DOM contract'ı koruması gerekir.

Keyboard script rollback edilirse core scheduled tasks panel çalışmaya devam edebilir.

Enhancement rollback edilirse temel create/list/cancel akışı korunabilir.

Core UI rollback edilirse enhancement scriptlerinin yüklenmemesi gerekir.

## Roll-forward

Rollback nedeni düzeltildikten sonra aynı feature yeni branch üzerinden yeniden geliştirilir.

Stale branch doğrudan yeniden kullanılmamalıdır.

Yeni tur güncel main SHA'dan başlamalıdır.

## Verification after rollback

`Görevler` UI beklenen durumda olmalıdır.

Existing prompt/conversation workspaces çalışmalıdır.

PWA shell açılmalıdır.

`/api/` network-only olmalıdır.

Client bundle secret içermemelidir.

## Support guidance

Kullanıcıya schedule auth token verilmez.

Kullanıcıdan yalnızca görünen hata mesajı ve gerekirse Trace ID alınır.

Server schedule kayıtlarının silindiği varsayılmaz.

## Recovery acceptance

Rollback sonrası veri kaybı olmamalıdır.

Rollback sonrası auth bypass oluşmamalıdır.

Rollback sonrası stale schedule API cache görünmemelidir.

Rollback sonrası client crash yaşanmamalıdır.
