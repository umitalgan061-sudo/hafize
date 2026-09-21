# GitHub çalışma alanı maintenance

## Günlük bakım

Workspace için günlük veri migrasyonu veya scheduled cleanup gerekmez; browser session state otomatik olarak oturum ömründedir.

## GitHub API değişiklikleri

GitHub response alanları değiştiğinde reader normalization katmanı güncellenir. UI doğrudan upstream response şekline bağlanmaz.

## Cache değişikliği

Yeni workspace asset'i eklendiğinde sw-policy cache version artırılır ve asset listesi güncellenir.

## TypeScript değişikliği

Yeni typed entrypoint Vite build map ve dev replacement ile birlikte eklenir. Index path ve service worker path aynı bundle adını kullanmalıdır.

## Güvenlik regresyonu

Secret path, credential content, allowlist ve write method kontrolleri her değişiklikten sonra yeniden çalıştırılır.

## Test bakımı

Statik scriptler kaynak sözleşmesini, Vitest dosyaları runtime normalization davranışını kapsar. Bir test obsolete olduğunda sessizce silinmez; yeni sözleşme tanımlanır.

## Hata kodları

Yeni hata kodları önce backend error contractına eklenir, ardından kullanıcı mesajı map'i güncellenir.

## Geriye uyumluluk

README ve docs yeni feature'ı açıklamalı; eski GitHub read kullanımının anlamını değiştirmemelidir.
