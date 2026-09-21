# GitHub çalışma alanı compatibility

## Browser

Modern TypeScript entrypoint Vite üzerinden build edilir. Geliştirme ortamında typed source doğrudan yüklenir.

## PWA

Service worker workspace CSS ve typed JS bundle'larını shell listesinde tutar. API response'ları shell cache'e alınmaz.

## Authentication

Public deployment auth guard devreye girdiğinde workspace route'ları protected olur. Local development policy mevcut uygulama davranışını korur.

## GitHub API

Workspace, GitHub REST API JSON response'larının yalnız normalize edilmiş alt kümesini kullanır. Upstream response şekli değiştiğinde normalization katmanı korunmalıdır.

## Storage

SessionStorage yalnız UI state ve recent repository isimlerini tutar. LocalStorage veya conversation storage'a yeni dependency eklenmez.

## Degradation

GitHub entegrasyonu yapılandırılmamışsa ana sohbet yüzeyi çalışmaya devam eder. Workspace kendi başına uygulama boot'unu başarısız kılmamalıdır.

## Legacy

Mevcut eski JavaScript bootstrap katmanlarıyla çakışmamak için workspace typed-build altında izole bir entrypoint olarak tutulur.
