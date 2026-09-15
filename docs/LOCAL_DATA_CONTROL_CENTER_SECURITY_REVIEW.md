# Yerel Veri Merkezi — Güvenlik İncelemesi

## Threats

En önemli tehditler yanlış storage silme, sınırsız kullanıcı verisi okuma, hassas içeriğin metadata export'a sızması ve cross-feature state'in yanlışlıkla yönetilmesidir.

## Controls

Explicit registry, bounded read, metadata-only manifest ve confirmation bu riskleri ayrı katmanlarda sınırlar.

## Least privilege

Controller yalnız kendi registry key'lerine erişir. Browser credential, cookie veya account API erişimi yoktur.

## Integrity

Clear işlemi sonucunu boolean olarak raporlar. Exception sessizce başarıya çevrilmez.

## Confidentiality

Manifest ham değer içermez. UI row yalnız label, açıklama, count ve byte metadata gösterir.

## Availability

Storage erişilemiyorsa feature fail-soft çalışır. Chat feature'ı local data center yüzünden durmamalıdır.

## Future change gate

Registry değişikliğinde sensitivity, data retention, clear semantics, export impact, migration ve rollback birlikte gözden geçirilmelidir.

## Security regression

Network API, telemetry, cookie reading veya arbitrary key deletion ekleyen herhangi bir değişiklik bu sözleşmeyi bozmuş sayılır.
