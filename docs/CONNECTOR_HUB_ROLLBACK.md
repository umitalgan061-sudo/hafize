# Bağlantılar geri alma

## UI rollback

Aşağıdaki dosyaların değişiklikleri birlikte geri alınır:

- public/connector-hub.js
- public/connector-hub.css
- public/index.html
- public/sw-policy.js
- public/workspace-navigation.js

## Server rollback

Connector hub server runtime'larını değiştirmediği için server connector kodunu geri almak zorunlu değildir.

## Storage

hafize.connector-hub.v1 yalnız UI collapse state içerir. Revert sonrasında eski anahtar güvenle bırakılabilir.

## Cache

Yeni JS/CSS shell asset listesinde kaldığı sürece tarayıcı eski sürümü taşıyabilir. Yeni service worker sürümü rollout sırasında eski cache temizleme mekanizması kullanılır.

## Incident

Credential sızıntısı şüphesinde UI rollback ile yetinilmez; ilgili connector secret/token operasyonu ayrıca döndürülür.

## DoD

Revert sonrası Bağlantılar workspace kartlarının yokluğu ve mevcut diğer workspace'lerin çalışması doğrulanır.
