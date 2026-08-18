# Schedule liste yanıtı sınırı

`GET /api/schedules` authenticated owner'ın tüm kayıtlarını sınırsız JSON olarak istemciye taşımamalıdır. Hafize bu nedenle HTTP boundary'de bounded ve sayfalanabilir bir liste sözleşmesi uygular.

## Varsayılan politika

- Varsayılan sayfa en fazla **200** schedule kaydı döndürür.
- Server/test enjeksiyon üst sınırı **500** kayıttır.
- İstemci `limit` ile server sınırından daha küçük bir sayfa isteyebilir.
- `offset` değeri **0–10.000** aralığında bounded tutulur.
- İlk sayfa 200 veya daha az kayıtsa mevcut command çıktısı değiştirilmeden korunur.
- Liste kesildiğinde `listMeta.returned`, `listMeta.total`, `listMeta.offset`, `listMeta.nextOffset` ve `listMeta.truncated` döner.

## Strict query sözleşmesi

Yalnız iki query alanı kabul edilir:

- `limit`: canonical pozitif integer; production server sınırını aşamaz.
- `offset`: canonical sıfır veya pozitif integer; en fazla 10.000.

Duplicate parametre, unknown query alanı, negatif/ondalıklı değer, leading-zero varyantı veya limit aşımı `INVALID_SCHEDULE_LIST_QUERY` ile **400** döner. Bu doğrulama `commands.list` çalıştırılmadan önce yapılır; bozuk query authoritative store snapshot'ı üretmez.

Örnekler:

- `/api/schedules` → ilk 200 kayıt.
- `/api/schedules?limit=50` → ilk 50 kayıt.
- `/api/schedules?limit=50&offset=50` → sonraki 50 kayıt.

## Aktif görev önceliği

Owner başına aktif schedule sınırı varsayılan 100 olduğundan ilk bounded sayfa tüm aktif görevleri görünür tutacak şekilde tasarlanmıştır.

Öncelik sırası:

1. `scheduled`
2. `running`
3. kalan kapasite kadar en yeni terminal kayıtlar

Aktif ve terminal grupların kendi içinde en güncel zaman önce gelir. `updatedAt`, ardından `createdAt`, ardından `runAt` kullanılır; eşitlikte numeric `schedule_N` kimliği tie-break sağlar. Sonraki `offset` sayfaları aynı deterministic ordering üzerinden ilerlediği için kayıtlar sayfalar arasında tekrarlanmaz.

Aktif görev sayısı liste limitini aşarsa yalnız en yeni aktif kayıtlar ilk sayfada döner. Production owner aktif sınırı 100 ve production liste limiti 200 olduğu için varsayılan Hafize akışında bu durum beklenmez; helper yine fail-safe bounded kalır.

## Neden HTTP boundary?

Command boundary owner isolation ve authorization kararını verir; storage authoritative geçmişi korur. Liste truncation/pagination yalnız transport/response-size politikasıdır. Bu nedenle:

- kalıcı kayıt silinmez;
- eski geçmiş `offset` sayfalarıyla erişilebilir kalır;
- snapshot schema değişmez;
- worker davranışı değişmez;
- create/reschedule/cancel yolları etkilenmez;
- UI'nın istemeden çok büyük geçmiş yüklemesi önlenir.

## Güvenlik

Authentication query validation ve liste command'ından önce uygulanmaya devam eder. Boundary yeni fetch, connector, token, cookie veya secret okumaz. Ajan tool policy, external write/send/merge approval ve dört profilli roster değişmez.

## Geri alma

`schedule-list-boundary.mjs` ve `schedule-http-api.mjs` içindeki GET pagination wiring'i kaldırılır. Kalıcı veri veya schema değişmediği için migration gerekmez.
