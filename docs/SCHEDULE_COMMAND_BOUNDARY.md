# Authenticated schedule command boundary

Bu katman schedule oluşturma, listeleme ve iptal işlemlerini doğrudan HTTP'ye açmadan önce sahiplik ve kimlik doğrulama sınırını tanımlar.

## Principal sözleşmesi

Boundary token veya session doğrulamaz. Yalnızca upstream auth katmanı tarafından doğrulanmış şu biçimde bir principal kabul eder:

```js
{ authenticated: true, subject: 'opaque-user-subject' }
```

`authenticated !== true`, boş `subject` veya geçersiz principal `AUTH_REQUIRED` ile reddedilir. Böylece ileride Google, Firebase Auth, OIDC veya başka bir identity provider eklenirken schedule authorization mantığı değişmez.

## Create

Client yalnızca `agentId`, `task`, `runAt` ve opsiyonel `maxAttempts` gönderebilir. `traceId`, `ownerId`, token, credential veya başka ek alanlar reddedilir.

- `traceId` server tarafından üretilir.
- `ownerId` doğrulanmış principal `subject` değerinden türetilir.
- `agentId` registry'de mevcut olmalıdır.
- Store kapasite hatası sanitize edilmiş `SCHEDULE_CAPACITY_REACHED` koduna çevrilir.

## List ve cancel

`list()` yalnızca çağıran kullanıcıya ait kayıtları döndürür. Internal/unowned schedule kayıtları kullanıcı listesine girmez.

`cancel()` önce schedule sahipliğini kontrol eder. Başka kullanıcıya ait veya bulunmayan bir schedule için aynı `SCHEDULE_NOT_FOUND` sonucu döner; böylece schedule ID varlığı sızdırılmaz. Yalnızca `scheduled` durumundaki görevler iptal edilebilir.

## Güvenlik sınırları

- Bu modül public endpoint değildir.
- Bearer token parsing veya auth doğrulama burada yapılmaz.
- Yeni agent/tool permission eklemez.
- Schedule oluşturmak dış write/send/merge onayı vermez.
- Secret değerleri schedule metadata'sına eklenmez.
- Public schedule sonucunda internal `ownerId` alanı dönmez.
- `.env`, credentials ve `.github/workflows/` bu değişikliğin kapsamı değildir.

Bir sonraki aşamada gerçek bir auth adapter, doğrulanmış principal üretip bu boundary'yi çağırabilir. Auth olmadan schedule endpoint'i açılmamalıdır.
