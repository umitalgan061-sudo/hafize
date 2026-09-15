# Zamanlanmış Görevler — Mimari

## Katmanlar

Scheduled Tasks özelliği mevcut server runtime ile client workspace arasında ince bir UI katmanı kurar.

Server katmanları:

- schedule HTTP API
- schedule command boundary
- schedule storage
- schedule worker
- execution runtime
- lease runtime

Client katmanları:

- `scheduled-tasks.js`
- `scheduled-tasks-enhancements.js`
- `scheduled-tasks-keyboard.js`
- `scheduled-tasks.css`

## HTTP boundary

Client yalnızca `/api/schedules` contract'ına bağlanır.

Backend command boundary auth, ownership, agent, task ve schedule validation yapar.

Client server command boundary'yi yeniden uygulamaya çalışmaz.

## Create flow

Kullanıcı formu submit eder.

Client local datetime değeri ISO'ya dönüştürür.

Client POST body oluşturur.

HTTP API request'i authenticated principal'a bağlar.

Command boundary agent ve task validation yapar.

Store schedule kaydını oluşturur.

Server response'u UI'ya döner.

UI formu temizler ve GET ile gerçek listeyi tekrar okur.

## List flow

Panel açılır.

Client GET `/api/schedules` gönderir.

Command list principal ownership uygular.

UI status filtrelemesini local DOM üzerinde yapar.

Server state değiştirilmez.

## Cancel flow

Kullanıcı planlı task için cancel seçer.

Native confirm alınır.

DELETE `/api/schedules/:id` gönderilir.

Command boundary owner ve state kontrolü yapar.

UI response sonrası listeyi refresh eder.

## Refresh flow

Panel açıkken 30 saniye civarında GET yenilemesi yapılır.

Yeni request başlamadan önce mevcut AbortController iptal edilir.

Panel kapanırken interval temizlenir.

## Template flow

Template seçimi yalnızca form textarea alanını doldurur.

API çağrısı yapılmaz.

Kullanıcı template'i düzenleyebilir.

## Filter flow

Status filter yalnızca row görünürlüğünü değiştirir.

Server'a filter query gönderilmez.

Bu, backend API'nin gelecekte genişletilmesine engel olmaz.

## Accessibility flow

Dialog açılır.

Focus kapatma kontrolüne gider.

Form native controls ile erişilebilir.

Status live region güncellenir.

Escape close yapar.

Focus mümkün olduğunda önceki elemente döner.

## PWA flow

Service worker CSS ve JS asset'lerini shell cache'e dahil eder.

Schedule API network-only kalır.

Offline shell gösterilebilir, ancak task snapshot'ı stale cache'ten üretilmez.

## Security flow

Client secret bilmez.

Task text textContent ile render edilir.

Trace ID server tarafından üretilir.

Schedule ID path'te encode edilir.

Owner filtering backend'de yapılır.

## State ownership

Server authoritative state: schedule kaydı ve status.

Client ephemeral state: modal open/close, filter, loading state.

Client persistent state: scheduler credential veya task status saklanmaz.

Template data statik client asset'tir.

## Failure handling

Network failure user-visible status üretir.

401 auth mesajıdır.

409 state race olarak ele alınır.

503 capacity problemidir.

Client failure sonrası server state'i tahmin etmez.

## Extension points

Recurring schedules daha sonra eklenebilir.

Schedule edit endpoint'i daha sonra eklenebilir.

Retry-now command daha sonra eklenebilir.

Timezone-specific picker daha sonra eklenebilir.

Notification delivery daha sonra eklenebilir.

Bu release bu extension point'leri sahte biçimde uygulamaz.

## Non-goals

Client-side scheduler yoktur.

Service worker ile background schedule execution yoktur.

Client telemetry yoktur.

Secret persistence yoktur.

Duplicate scheduler storage yoktur.

## Architecture acceptance

Yeni client code mevcut API'yi kullanmalıdır.

Server validation bypass edilmemelidir.

UI data ownership server'a bırakılmalıdır.

PWA API cache'lememelidir.

Rollback client layer'ını server storage'dan ayırabilmelidir.
