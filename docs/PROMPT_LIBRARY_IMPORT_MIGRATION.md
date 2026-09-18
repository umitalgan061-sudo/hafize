# Import migration

## Storage anahtarı
Mevcut hafize.prompt-library.v1 anahtarı değişmez.

## Eski yedek
Düz JSON dizi formatı kabul edilir.

## Yeni yedek
version/source/exportedAt/items wrapper'ı kabul edilir.

## Backward compatibility
Eski Prompt Library istemlerinin yeniden import edilmesi için ek migration adımı gerekmez.

## Recovery
Recovery snapshot ayrı bir üst seviye biçimdir ve diagnostics incelemesi için kullanılır.
