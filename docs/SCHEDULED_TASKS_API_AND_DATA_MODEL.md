# Zamanlanmış Görevler — API ve Veri Modeli

## API yüzeyi

Schedule istemcisi üç mevcut endpoint kullanır.

`GET /api/schedules` kimliği doğrulanmış kullanıcının schedule kayıtlarını döndürür.

`POST /api/schedules` yeni schedule oluşturur.

`DELETE /api/schedules/:id` kullanıcının kendi planlanmış kaydını iptal eder.

Client her istekte `credentials: same-origin` kullanır.

## Liste yanıtı

Başarılı liste yanıtı `{ ok: true, schedules: [...] }` biçimindedir.

UI yalnızca birinci taraf schedule alanlarına güvenir. Tanım dışı alanları işlemek veya DOM'a taşımak için ayrı bir yol bulunmaz.

Liste kayıtları aşağıdaki alanları içerir:

- `scheduleId`
- `traceId`
- `agentId`
- `task`
- `runAt`
- `status`
- `attempts`
- `maxAttempts`
- `lastError`
- `createdAt`
- `updatedAt`

`ownerId` response içinde yayınlanmaz. Ownership backend'de doğrulanır.

## Oluşturma isteği

POST gövdesinde yalnızca şu alanlar kabul edilir:

`agentId`

`task`

`runAt`

`maxAttempts`

Bunların dışındaki alanlar command boundary tarafından reddedilir.

## agentId

UI ana ajan seçicisinde mevcut seçenekleri kullanır. Backend registry üzerinde agentId'nin gerçekten var olduğunu tekrar doğrular.

Geçersiz agentId 400 sınıfında `INVALID_AGENT` hatasına dönüşür.

## task

Görev metni boş olamaz.

Backend schedule command boundary 20.000 karakter üstünü reddeder.

Plaintext credential politikası görev metninde de uygulanır. UI bu server-side kuralı kopyalamak yerine yalnızca güvenli form sınırlarını uygular.

## runAt

İstemci yerel `datetime-local` değerini ISO string'e çevirir.

Backend store tekrar ISO doğrulaması yapar.

UI geçmiş zamanları reddeder.

Server runtime kendi saat doğrulamasıyla asıl otoritedir.

## maxAttempts

UI 1–5 seçenekleri sunar.

Store maksimum 5 değerini uygular.

İstemci değerinin değiştirilmesi backend sınırını aşamaz.

## Durum geçişleri

Normal başlangıç:

`scheduled`

Worker görevi aldığında:

`running`

Başarı:

`completed`

Başarısızlık ve retry koşulu yoksa:

`failed`

Kullanıcı planlanmış görevi iptal ederse:

`cancelled`

UI bu durumları yeniden üretmez; backend'in yayınladığı durumu gösterir.

## Ownership

List endpoint'i yalnızca authenticated principal'a ait kayıtları döndürür.

Cancel komutu da önce kaydı okur ve `ownerId` ile eşleştirir.

Başka kullanıcının schedule ID'si bilinse bile UI'nin delete çağrısı backend ownership kontrolünü aşamaz.

## Hata modeli

401: `AUTH_REQUIRED`

400: geçersiz command veya agent

404: bulunamayan schedule

409: artık iptal edilemeyen schedule

503: schedule kapasitesi dolu

Client error handling bu sınıfları kullanıcıya anlamlı durumlarla eşler.

## Trace metadata

`traceId` yürütme izlenebilirliği içindir.

Client trace ID üretmez.

Client trace ID'yi bearer credential veya session identifier gibi kullanmaz.

## Client state

UI tarafında filtrelenen durum yalnızca görünüm state'idir.

Server schedule kaydının `status` alanı localStorage'a kopyalanmaz.

Refresh yeniden GET isteği yapar ve server snapshot'ını temel alır.

## Polling

Panel açıkken periyodik refresh kullanılır.

Polling yalnızca GET'tir.

Panel kapandığında interval durdurulur ve bekleyen request abort edilir.

## Concurrency

Aynı panel içinde yeni bir GET başlamadan önce mevcut AbortController iptal edilir.

Bu, kapanmış panelden gelen gecikmiş cevabın yeni görünümü ezmesini azaltır.

Oluşturma düğmesi request sırasında devre dışıdır.

## İstemci veri hijyeni

Task text DOM'a `textContent` ile yazılır.

Trace ID `title` ve ARIA label üzerinden gösterilir.

HTML veya script enjeksiyonu için `innerHTML` kullanılmaz.

URL path parametresi `encodeURIComponent` ile güvenli biçimde taşınır.

## Cache sınırı

Service worker schedule UI asset'lerini cache'ler.

`/api/` path'leri shell cache dışında tutulur ve network-only sınıfındadır.

Böylece eski schedule verisinin offline shell cache'den gerçek veri gibi gösterilmesi önlenir.

## Geriye dönük uyumluluk

Schedule backend sözleşmesi değişmeden client UI eklenmiştir.

UI'da desteklenmeyen alanlar request'e gönderilmez.

Yeni backend statusları yayınlanırsa bilinmeyen status badge'i `Bilinmiyor` ile gösterilir; UI çökmez.

## Kabul kriterleri

Kimliksiz liste isteği 401 olmalıdır.

Yetkisiz schedule iptali gerçekleşmemelidir.

Geçersiz agent oluşturulamamalıdır.

Geçmiş zaman oluşturulamamalıdır.

20.000 karakter üstü task kabul edilmemelidir.

Kapasite doluysa 503 durumu kullanıcıya yansıtılmalıdır.

Planlı görev iptal edilebilmeli; running veya completed görevlerde iptal düğmesi görünmemelidir.
