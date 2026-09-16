# Zamanlanmış Görevler API Kontratı

## Kimlik doğrulama

Tüm schedule endpoint'leri uygulama oturumunu gerektirir. Kimlik doğrulama başarısızsa `401 AUTH_REQUIRED` döner ve `WWW-Authenticate: Bearer` başlığı verilir.

## Görev oluşturma

`POST /api/schedules`

Gövde:

```json
{
  "agentId": "hafize-general",
  "task": "Sabah özetini hazırla.",
  "runAt": "2026-09-17T06:00:00.000Z",
  "maxAttempts": 2
}
```

`agentId`, registry'deki gerçek bir ajan olmalıdır. Görev metni boş olamaz ve uygulamanın plaintext credential politikası tarafından reddedilen secret biçimleri taşıyamaz.

Başarılı cevap HTTP 201 ile `schedule` nesnesi döndürür. `ownerId` hiçbir zaman public API yanıtına dahil edilmez.

## Sayfalı listeleme

`GET /api/schedules?limit=50&status=scheduled&sort=runAt-asc&q=rapor&cursor=...`

Desteklenen `status` değerleri `all`, `scheduled`, `running`, `completed`, `failed`, `cancelled` değerleridir.

Desteklenen `sort` değerleri:

- `runAt-asc`
- `created-desc`
- `updated-desc`

`limit` 1 ile 100 arasında olmalıdır. `q` en fazla 160 karakter, cursor en fazla 1024 karakterdir.

Örnek cevap:

```json
{
  "ok": true,
  "schedules": [],
  "total": 0,
  "hasMore": false,
  "nextCursor": null
}
```

İstemci `nextCursor` değerini opaque kabul etmelidir.

## İstatistikler

`GET /api/schedules/stats`

Cevap kullanıcıya özel toplamları döndürür:

```json
{
  "ok": true,
  "stats": {
    "total": 1200,
    "counts": {
      "scheduled": 800,
      "running": 4,
      "completed": 300,
      "failed": 50,
      "cancelled": 46
    },
    "due": 12,
    "retrying": 3,
    "capacity": "unbounded"
  }
}
```

## Tekli iptal

`DELETE /api/schedules/:scheduleId` sadece aynı owner'a ait `scheduled` kaydı iptal eder. Başka kullanıcıya ait kimlikler `SCHEDULE_NOT_FOUND` ile dışarıya kapatılır.

## Toplu iptal

`POST /api/schedules/bulk-cancel`

```json
{ "scheduleIds": ["schedule_1", "schedule_2"] }
```

Bir istek en fazla 100 benzersiz kimlik taşıyabilir. Yetkisiz kayıtlar sessizce atlanır; başka kullanıcının kaydı iptal edilmez.

## Hata modeli

API hata cevapları merkezi `normalizeApiError` kontratından geçer. Provider secret detayları istemciye aktarılmaz. İstemci status code yerine `code` alanını davranış kararlarında kullanmalıdır.
