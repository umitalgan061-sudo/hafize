# Markdown migration notları

## Storage

Mevcut conversation storage formatı değiştirilmez.

Assistant message body ham metin olarak kalır.

Markdown DOM'u kalıcı değildir.

## Deployment

Renderer assetleri public shell'e eklenir.

Service worker cache version yükseltilir.

Eski cache'ler mevcut policy ile temizlenir.

## Kullanıcı ayarı

Yeni `hafize.markdown-rendering.v1` anahtarı yalnız görüntüleme tercihini tutar.

Mevcut kullanıcıların varsayılan davranışı Markdown açık olacak şekilde devam eder.

## Backward compatibility

Eski conversation kayıtları ek bir migration olmadan render edilir.

Markdown olmayan plain text yanıtlar değişmeden görünür.

## Rollout sırası

1. Renderer assets.
2. Safe link policy.
3. Code tools.
4. Message actions.
5. Outline.
6. Preference.

## Rollback

PR revert yapılabilir.

Storage schema migration gerekmez.

Preference anahtarı silinmese bile renderer default açık olduğundan davranış geri alınabilir.

## QA

Eski sohbet, yeni sohbet, uzun sohbet ve stream edilmiş sohbet ayrı ayrı doğrulanmalıdır.

## Risk

En yüksek risk DOM renderer ile streaming observer etkileşimidir.

İkinci risk unsafe URL parsing'dir.

Üçüncü risk PWA stale cache'dir.

Bu riskler test ve runbook ile kapsanır.
