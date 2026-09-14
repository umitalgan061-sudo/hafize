# Prompt Library Migration Policy

## v1

İlk production veri anahtarı `hafize.prompt-library.v1` olarak tanımlıdır.

Bu sürümde migration gerekmez; kayıtlar read/write sırasında normalize edilir.

## Gelecek sürümler

Schema değişecekse yeni key veya açık migration fonksiyonu tercih edilmelidir.

Mevcut v1 veri geri döndürülemez biçimde silinmemelidir.

Migration iki aşamalı olmalıdır: parse/validate ve commit.

Parse aşamasında eski veri değiştirilmez.

Commit aşamasında yeni kayıtlar yazılır, ardından yeni version marker eklenir.

## Import

External JSON import migration değil, bounded normalization olarak kabul edilir.

Import version alanı parse metadata'sıdır ve tek başına kod çalıştırmaz.

Unknown fields ignore edilir.

## Starter

Starter prompt'lar version migration değildir.

Starter seed mevcut kullanıcı kayıtlarını overwrite etmez.

## State

UI state ayrı anahtarda olduğu için schema evrimi prompt kayıtlarından bağımsız yapılabilir.

Geçersiz sort değeri default state'e döner.

## Geriye uyumluluk

Kullanıcının v1 JSON'u v1 API tarafından tekrar okunabilir.

Kayıt eksik alanlarla gelirse normalize fonksiyonu güvenli default uygular.

## Test gereksinimi

Bir migration eklendiğinde:

- eski örnek fixture,
- yeni örnek fixture,
- invalid fixture,
- id collision fixture,
- limit fixture

eklenmelidir.

Her migration veri kaybı olmaması ve tekrar çalıştırıldığında deterministic olması açısından test edilmelidir.
