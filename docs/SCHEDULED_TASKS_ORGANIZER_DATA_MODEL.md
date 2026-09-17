# Organizer — Veri Modeli

## Kaynak kayıt

Organizer server'dan dönen schedule kayıtlarını kullanır.

Temel alanlar `scheduleId`, `agentId`, `task`, `runAt`, `status`, `attempts`, `maxAttempts`, `lastError`, `traceId` ve zaman metadata alanlarıdır.

Organizer kayıtları yeniden adlandırmaz.

## Görünüm modeli

Kaydedilen görünüm şu biçimdedir:

```json
{
  "id": "görünüm-kimliği",
  "name": "Bugünkü işler",
  "view": {
    "query": "rapor",
    "agent": "research",
    "sort": "runAt-asc",
    "status": "scheduled",
    "time": "today"
  },
  "savedAt": "ISO-8601"
}
```

`query` 120 karakterle sınırlıdır.

`agent` 80 karakterle sınırlıdır.

En fazla altı kayıtlı görünüm tutulur.

## Seçim state'i

Satır seçimi DOM checkbox state'idir.

Kalıcı storage'a yazılmaz.

Panel kapanınca seçimler korunmak zorunda değildir.

Toplu iptal seçimi yalnızca `scheduled` satırlarda etkinleştirir.

## Export modeli

Export payload'ı `version`, `source`, `exportedAt` ve `schedules` alanlarını içerir.

Export edilen task kaydı server snapshot'ından alınır.

Client yeni task alanı uydurmaz.

1 MB boyutu aşan dosya yazımı engellenir.

## Ayrıntı modeli

Detail view, satırdan okunmuş güvenli bir özet üretir.

Görev metni tam metin olarak yalnızca detail içinde gösterilebilir.

Trace ID tanılama amaçlıdır ve authentication bilgisi değildir.

## Storage sınırı

Organizer storage key yalnızca görünüm presetleri için kullanılır.

Task payload, cookie, token ve credential localStorage içine yazılmaz.

Storage exception durumunda UI varsayılan görünümle çalışır.

## Uyumluluk

Server response şeması değiştiğinde bilinmeyen alanlar yalnızca yok sayılır.

Eksik `runAt` değeri zaman sıralamasında güvenli fallback kullanır.

Eksik `status` client tarafından tamamlanmaz.

## Migration

Eski organizer sürümünde storage key bulunmaması normaldir.

Yeni sürüm boş görünüm preset listesiyle başlar.

Storage anahtarı değiştirilecekse migration ayrı ve bounded bir turda yapılmalıdır.

## Test edilecek invariantlar

Preset sayısı altıdan fazla olmamalıdır.

İsim boş olamaz.

Geçersiz sort default'a dönmelidir.

Geçersiz status `all` olmalıdır.

Geçersiz time `all` olmalıdır.

Export task içeriğini storage'a taşımamalıdır.
