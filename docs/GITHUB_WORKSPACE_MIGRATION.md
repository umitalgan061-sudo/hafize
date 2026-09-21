# GitHub çalışma alanı migration

## Başlangıç

Yeni workspace dağıtımı için mevcut HAFIZE GitHub read allowlist'i yeterlidir; yeni bir token formatı gerektirmez.

## Browser migration

Index yeni typed workspace entrypoint'lerini yükler. Vite development replacement sayesinde local development path'i typed source'a yönelir.

## PWA migration

Service worker cache version workspace asset'lerini içerecek şekilde artırılır. Eski cache aktivasyon sırasında temizlenebilir.

## Storage migration

Workspace ilk kullanımda mevcut değer olmadan başlar. SessionStorage state bulunamadığında boş repository/ref/path kullanılır.

## Roll-forward

Yeni release'te repo okunabiliyor, branch listeleniyor, commit ve PR listeleri yükleniyor, file read güvenlik filtresinden geçiyor ve compare sonucu görünüyor olmalıdır.

## Rollback

Workspace bundle ve server routes revert edilir. Prompt Library veya conversation data migration yapılmaz.

## Production verification

Protected endpoint unauthenticated erişimde reddedilmeli, allowlist dışı repository 403 almalı ve GitHub upstream hataları sabit error code ile dönmelidir.
