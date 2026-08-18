# Schedule list snapshot contract

`GET /api/schedules` sayfalaması canlı worker değişiklikleri sırasında sessizce kayıt atlamamalı veya aynı kaydı iki kez göstermemelidir.

## Protokol

İlk istek `offset=0` ile veya offset olmadan yapılır. Liste `limit` nedeniyle kesiliyorsa cevap `listMeta.snapshot` alanında 43 karakterlik base64url SHA-256 fingerprint ve `nextOffset` döndürür.

İkinci ve sonraki sayfalar `offset=<önceki nextOffset>` ile birlikte aynı `snapshot` değerini göndermek zorundadır. `offset > 0` olup snapshot yoksa veya snapshot biçimsizse istek `commands.list` çalıştırılmadan `400 INVALID_SCHEDULE_LIST_QUERY` ile reddedilir.

Snapshot gönderildikten sonra owner'a ait schedule kümesinin pagination açısından anlamlı kimlik/durum/zaman alanları değişirse istek `409 SCHEDULE_LIST_SNAPSHOT_CHANGED` döner. İstemci yeni bir ilk sayfa isteğiyle pagination'ı yeniden başlatmalıdır. Hafize eski snapshot altında yeni listeyi sessizce dilimlemez.

## Fingerprint kapsamı

Fingerprint yalnız sıralanmış schedule kayıtlarının şu server-side alanlarından üretilir:

- `scheduleId`
- `status`
- `updatedAt`
- `createdAt`
- `runAt`

Task metni, owner kimliği, trace, hata ayrıntısı, provider credential veya başka secret fingerprint materyaline girmez. Fingerprint bir authorization token değildir; authentication ve owner isolation `commands.list` sınırında ayrıca uygulanmaya devam eder.

## Neden stateful snapshot store yok?

Bu sözleşme process-local pagination state'i veya yeni kalıcı storage oluşturmaz. Restart/deploy sonrası tutulması gereken cursor tablosu yoktur. Bunun yerine değişiklik algılandığında fail-closed 409 döner. Böylece bounded API davranışı korunurken sessiz duplicate/missing page riski ortadan kaldırılır.

## Güvenlik sınırları

- Snapshot tam 43 karakter ve dar base64url karakter kümesiyle doğrulanır.
- İlk sayfada istemci snapshot gönderemez; server yeni fingerprint'in otoritesidir.
- Bilinmeyen veya duplicate query alanları reddedilmeye devam eder.
- `limit <= 500`, `offset <= 10000` sınırları değişmez.
- Bearer/cloud-session auth, exact Origin gerektiren mutasyonlar ve owner isolation değişmez.
- Yeni endpoint, write yetkisi, agent tool'u, storage, secret veya credential yüzeyi eklenmez.
- Dört profilli selector/specialist registry ve backend default-deny politikası değişmez.

## İstemci davranışı

İstemci ilk sayfadaki `nextOffset` ve `snapshot` değerini birlikte saklamalıdır. Sonraki sayfa 409 dönerse eski birikmiş pagination state'i bırakılmalı ve ilk sayfa yeniden yüklenmelidir. Bu state yalnız UI oturumu için gereklidir; persistent storage zorunlu değildir.
