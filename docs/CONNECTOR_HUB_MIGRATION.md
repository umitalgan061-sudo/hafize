# Connector hub migration

## Ön koşul

Workspace navigation içinde connections workspace mevcut olmalıdır.

## Asset ekleme

Index'e connector hub CSS ve JS eklenir.

## PWA

Service worker shell listesine yalnız UI asset'leri eklenir.

## Runtime

Yeni server endpoint'i gerekmez. Mevcut health ve connector status endpoint'leri tüketilir.

## Storage

Yeni kalıcı schema oluşturulmaz.

## Deploy

Eski istemciler connector hub asset'i olmadan çalışabilir; yeni istemci yeni kartları yükler.

## Backward compatibility

Workspace navigation kart ID listesi genişletilir. Diğer workspace'lerin card ID'leri değiştirilmez.

## Failure

Asset bulunamazsa connector hub görünmez. Uygulamanın ana chat runtime'ı connector hub exception'ı nedeniyle durmamalıdır.

## Rollback

Index/service-worker bağlantıları, widget dosyaları ve workspace kart ID'si aynı değişiklik kümesinden geri alınabilir.

## Data safety

Migration sırasında credential taşınmaz.

## QA

Yeni sürüm eski sessionStorage payload ile açılmalı; bozuk state varsayılan open state'e dönmelidir.
