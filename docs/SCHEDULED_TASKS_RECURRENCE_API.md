# Recurrence API

## Create
POST /api/schedules authenticated owner ister.

İzin verilen create alanları:
agentId, task, runAt, maxAttempts, recurrence.

Recurrence:
daily + interval.
weekly + interval + daysOfWeek.
monthly + interval + dayOfMonth.
Unknown alanlar 400 olur.

## List
GET /api/schedules yalnız authenticated owner kayıtlarını döndürür.
Recurring kayıt history ve recurrence metadata taşıyabilir.

## Pause/Resume
PATCH /api/schedules/:id body action=pause veya action=resume.
Pause yalnız recurring scheduled kayıt için geçerlidir.
Resume yalnız recurring paused kayıt için geçerlidir.

## Cancel
DELETE /api/schedules/:id scheduled veya paused recurring kaydı iptal edebilir.
Running kaydın mevcut transition guard'ı korunur.

## Errors
AUTH_REQUIRED -> 401.
INVALID_SCHEDULE_COMMAND / INVALID_SCHEDULE / INVALID_AGENT -> 400.
SCHEDULE_NOT_FOUND -> 404.
SCHEDULE_NOT_CANCELLABLE -> 409.
SCHEDULE_CAPACITY_REACHED -> 503.

## Security
Endpoint mevcut schedule authenticator ve owner boundary üzerinden çalışır.
Recurrence yalnız bounded data kabul eder.
