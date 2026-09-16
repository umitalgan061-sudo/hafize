# Modern TypeScript security boundaries

## Client bundle

TypeScript kaynakları browser bundle'ına derlenir. Bu yüzden TypeScript'e taşınmak hiçbir secret'ın client'a taşınması anlamına gelmez.

`hafize-api.ts` yalnızca public API yollarına istek yapmak için kullanılır. Authorization credential üretmez, env değeri okumaz ve connector secret'larını taşımaz.

## Health data

Runtime health modeli yalnızca boolean kapasite alanlarını, durum kodunu ve ajan sayısını taşır. Bilinmeyen alanlar response'tan atılır.

Bu sayede beklenmeyen upstream payload alanları UI'a yanlışlıkla yansıtılmaz.

## Retry

Retry yalnızca açıkça transient kabul edilen HTTP durumlarında veya network hatalarında kullanılır. Retry sayısı sabittir ve gecikme bounded'dır.

Kullanıcı action'larına ait POST/DELETE istekleri bu helper tarafından otomatik retry edilmez; bu katman GET tabanlı health/models/agents keşfi için tasarlanmıştır.

## DOM

Typed UI modülleri DOM node'larını programatik oluşturur. Kullanıcı verisi `textContent`, `value`, `dataset` veya explicit attribute API'leri ile yazılır.

HTML string interpolation zorunlu olmadıkça kullanılmaz.

## Storage

Smart Fill preset'leri prompt id başına bounded localStorage anahtarlarında tutulur. Storage okunamazsa boş koleksiyonla devam edilir.

Local storage verisi backend analytics sistemine gönderilmez.

## PWA

Generated typed entry'ler shell cache'te tutulabilir. API yolları cache'lenmez. Health sonucu service worker storage'ına yazılmaz.

## Error disclosure

Typed API errors kullanıcıya sınırlı message/code/trace-id metadata'sı sağlayabilir. Ham upstream body veya secret değer UI'a taşınmaz.

## Build güvenliği

Build çıktısı `public/typed-build` altındadır. Kaynak TypeScript ile generated JavaScript ayrıdır. Generated output manuel düzenlenmemelidir.

Production start öncesi typecheck + bundle zorunluluğu, eski generated dosyanın sessizce deploy edilmesi riskini azaltır.
