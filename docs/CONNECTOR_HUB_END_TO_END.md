# Bağlantılar uçtan uca kabul rehberi

## Amaç

Bu belge, Bağlantılar workspace'inin UI, mevcut API, storage ve PWA katmanlarını birlikte doğrular.

## Giriş

Bağlantılar workspace'ine geçiş native navigation üzerinden yapılır.

Hub kartları utility rail içinde oluşturulur.

## Health

İlk açılışta /api/health sorgulanır.

GitHub, Gmail ve Canva configuration boolean'ları genel özet için kullanılır.

## Provider status

Gmail ve Canva status endpoint'leri paralel sorgulanır.

linked=true yalnızca “Bağlı” durumunu ifade eder.

## Refresh lifecycle

Refresh başladığında düğme disabled olur.

İkinci refresh aynı anda başlamaz.

Başarılı veya hatalı sonuç sonunda düğme tekrar etkin olur.

## Timeout

Sekiz saniyeyi aşan request abort edilir.

UI raw AbortError metni göstermez.

## Workspace event

Bağlantılar workspace tekrar seçildiğinde status sorgusu cooldown kuralları ile yeniden tetiklenebilir.

## Collapse

Gizle/göster state'i sessionStorage'da tutulur.

Bozuk state paneli kırmaz.

## Capability

Capability chips yalnız açıklama sağlar.

Bir capability chip'e tıklanarak server permission mutation başlatılamaz.

## Diagnostics

Tanı özeti:

- provider durumlarını
- connection özetini
- zamanı

taşır.

Credential, raw response ve owner identifier taşımaz.

## PWA

Hub JS/CSS shell asset'i olabilir.

API response cache'lenmez.

## Security

Client Authorization header yazmaz.

Client provider tokenı istemez.

## Accessibility

Aria labels, expanded/controls state ve text status korunur.

## Mobile

Dar ekranda status row tek kolona düşer.

## Failure

Health failure provider status sonuçlarından bağımsız gösterilebilir.

Bir provider'ın 401'i diğer provider kartını engellemez.

## Destroy

Controller destroy sonrası:

- timer temizlenir
- event listener kaldırılır
- kartlar kaldırılır
- async response DOM'u değiştiremez

## Release gate

Aşağıdaki dört kaynak birlikte gözden geçirilir:

- public/connector-hub.js
- public/connector-hub.css
- public/workspace-navigation.js
- public/sw-policy.js

Index ve server route sözleşmeleri ayrıca kontrol edilir.

## Rollback

Hub UI assetleri kaldırıldığında server connector runtime'ları değişmeden bırakılabilir.

Workspace navigation yalnız daha önceki kart ID setine döner.

## Sonuç

Bu kabul rehberi connector hub'ın gözlem katmanı olarak kalmasını ve existing authorization/policy katmanlarının yerine geçmemesini şart koşar.
