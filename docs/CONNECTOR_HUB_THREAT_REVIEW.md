# Connector hub tehdit incelemesi

## Credential theft

Risk: status response içinde credential dönmesi.

Kontrol: server endpoint yalnız linked veya boolean health alanları döndürür.

## Cross-origin abuse

Risk: malicious endpoint çağrısı.

Kontrol: sabit same-origin relative URL kullanımı.

## CSRF misuse

Risk: hub'ın state-changing endpoint çağırması.

Kontrol: yalnız GET.

## XSS

Risk: provider response'un DOM'a HTML olarak yazılması.

Kontrol: textContent ve createElement.

## Persistence leak

Risk: response'un localStorage'a yazılması.

Kontrol: yalnız collapse state sessionStorage.

## Refresh DoS

Risk: hızlı kullanıcı tıklamaları.

Kontrol: cooldown + in-flight guard.

## Destroy race

Risk: async response sonrası DOM mutation.

Kontrol: destroyed guard.

## Capability confusion

Risk: “bağlı” durumunun write yetkisi gibi algılanması.

Kontrol: capability katalogu ve açık salt-okunur notu.

## PWA stale behavior

Risk: yanlış API response cache'i.

Kontrol: service worker API network-only.
