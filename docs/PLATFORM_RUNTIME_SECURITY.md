# Platform Runtime Security

## Güvenlik sınırı

Platform runtime tarayıcı cihazının yeteneklerini gözlemler; secret üretmez, authentication credential saklamaz ve dış servislere yetki vermez.

## Storage

Runtime storage anahtarı `hafize.platform-runtime.v1` yalnızca küçük lifecycle metadata'sı için kullanılır. Prompt Library, conversation history ve connector token'ları ayrı alanlardadır.

## Secret redaction

`platform-error-boundary.ts` Bearer, token, api key, password ve secret benzeri hata mesajlarını redakte eder. Hata kaydının maksimum uzunluğu 220 karakterdir.

## Diagnostics

Tanılama paketi kullanıcı başlatmadan dışa aktarılmaz. Paket sohbet içeriği, auth cookie, API token veya secret içermez.

## DOM güvenliği

Dashboard ve runtime UI dinamik kullanıcı verisi için `textContent`, attribute API ve `replaceChildren()` kullanır. Runtime tarafında `innerHTML` tabanlı interpolasyon bulunmamalıdır.

## Permission model

Capability detection izin istemez. Mikrofon, ekran paylaşımı ve bildirim gibi izinli API'ler yalnızca ilgili özelliğin kendi kullanıcı akışında çağrılabilir.

## Network

Runtime metrics ve policy verileri üçüncü parti analytics endpoint'lerine gönderilmez. API çağrıları mevcut server-side application runtime tarafından yönetilir.

## Event hygiene

CustomEvent payload'ları snapshot veya redakte edilmiş metadata taşır. Büyük obje, DOM node veya credential event payload'ına eklenmez.

## Queue safety

Task queue bounded'dır. Maksimum 32 task vardır. Her task timeout ve AbortSignal ile sınırlandırılır. Queue worker hata aldığında başka task'lar yürümeye devam eder.

## Supply chain

Bu turda yeni runtime dependency eklenmemiştir. Vite/TypeScript/Vitest sürümleri repository'nin mevcut modern toolchain'i üzerinden kullanılır.

## Browser downgrade

Trusted Types veya modern performance API bulunmasa bile runtime çalışmalıdır. Policy katmanı `fallback` sonucu verir; feature tamamen çökertilmez.

## Incident response

Runtime degraded ise önce `Platform durumu` panelindeki feature, network ve storage değerleri incelenir. Daha sonra diagnostics JSON alınır. Secret veya kullanıcı içeriği paylaşılmadan hata kaynağı analiz edilir.

## Rollback

Platform bundle entry geri alınabilir. Runtime storage metadata'sının silinmesi gerekmez; eski uygulama sürümü bilinmeyen anahtarı yok sayabilir.
