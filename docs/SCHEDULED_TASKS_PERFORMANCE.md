# Zamanlanmış Görevler — Performance

## Client bounds

Liste en fazla 128 kayıt işler.

Task preview 120 karakter ile sınırlandırılır.

Error code 120 karaktere kadar gösterilir.

Trace ID 128 karakterle sınırlandırılır.

Task input 20.000 karakterdir.

Attempts 1–5 ile sınırlandırılır.

## Rendering

Liste render'ı replaceChildren ile yapılır.

Her schedule row ayrı DOM node olarak oluşturulur.

User content textContent ile eklenir.

No HTML parser round-trip yapılmaz.

## Polling

Polling interval 30 saniyedir.

Panel kapalıyken polling durur.

Close sırasında request abort edilir.

Manual refresh aynı GET endpoint'i kullanır.

## Request concurrency

Yeni request mevcut controller'ı abort eder.

POST submit sırasında button disabled olur.

Cancel sonrası liste yeniden okunur.

## PWA

Static assets cache'den hızlı açılabilir.

Schedule API cachelenmez.

Offline shell hızlı açılabilir ancak server state olmadan schedule listesi oluşturulmaz.

## Mobile

Tek sütun form daha az yatay layout maliyeti üretir.

List max-height ile bounded scroll kullanır.

## Accessibility cost

Live region yalnızca status metnini günceller.

No continuous announcement loop vardır.

Countdown script yalnızca scheduled rows için güncelleme yapar.

## Countdown

Countdown 1 saniyelik local text update kullanır.

Server request göndermez.

Completed/running/failed/cancelled rows için countdown node'u temizlenir.

## Memory lifecycle

Panel DOM yalnızca bir kere oluşturulur.

Polling timer close sırasında temizlenir.

AbortController eski request'leri durdurur.

Global shortcut listener tek bir handler olarak eklenir.

Beforeunload handler'ları cleanup sağlar.

## Server assumptions

Client backend schedule capacity'sini değiştirmez.

Client worker concurrency'ye müdahale etmez.

Client lease işlemi yapmaz.

Client execution retry uygulamaz.

## Performance acceptance

128 schedule kaydında UI makul şekilde render edilmelidir.

Büyük task text DOM'u gereksiz büyütmemelidir.

30 saniye polling server'a yoğun istek yağmuru oluşturmamalıdır.

Panel kapalıyken network aktivitesi olmamalıdır.

## Future scale

128 üstü schedule desteği gerekirse server pagination contract eklenmelidir.

Infinite scroll client-only olarak eklenmemelidir.

Virtualization ancak gerçek ölçümle gerekli olduğu kanıtlanırsa değerlendirilmelidir.

## Measurement

Performance tuning tahmini benchmark yerine gerçek browser profilinden yapılmalıdır.

Bu release'de client-side telemetry eklenmemiştir.

## Regression

Prompt Library search performansı schedule panelinden bağımsız kalmalıdır.

Conversation list performansı değişmemelidir.

Composer typing latency schedule polling nedeniyle etkilenmemelidir.
