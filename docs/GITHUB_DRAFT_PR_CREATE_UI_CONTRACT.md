# GitHub Draft PR Create UI Contract

## Amaç

Hafize kullanıcı arayüzünden yalnız `umitalgan061-sudo/hafize` deposunda, mevcut `hafize/` feature branch'lerinden **draft Pull Request** oluşturmak.

Bu özellik yeni GitHub yazma yetkisi açmaz. Yalnız mevcut `/api/github/write/prepare` ve `/api/github/write/execute` approval runtime'ındaki `pr.create` komutunu açık kullanıcı eylemine bağlar.

## Sabit hedef

- Repository istemci tarafından seçilemez: `umitalgan061-sudo/hafize`.
- Head branch zorunlu `hafize/` prefix'i taşır.
- Base branch dar ref karakter sözleşmesiyle doğrulanır.
- Head ve base aynı olamaz.
- PR başlığı boş olamaz ve en fazla 180 karakterdir.
- `draft` her zaman `true` olur; kullanıcı bunu kapatamaz.

## İki aşamalı açık onay

İşlem iki ayrı kullanıcı eylemi gerektirir:

1. `Onayı hazırla`: exact normalize edilmiş `pr.create` komutu backend approval boundary'ye gönderilir.
2. `Onayla ve draft PR aç`: yalnız aynı komut ve süresi geçmemiş tek kullanımlık approval token ile execute çağrısı yapılır.

Head, base veya title bu iki aşama arasında değişirse hazırlanmış token UI'da hemen geçersizleştirilir. Süresi geçmiş token execute edilmez.

## Backend güvenlik sınırı

Backend karar mercii olmaya devam eder. Mevcut GitHub write contract şunları yeniden doğrular:

- repository allowlist,
- `hafize/` head branch zorunluluğu,
- exact title/head/base şeması,
- draft-only PR kuralı,
- authenticated principal,
- owner-bound command digest,
- approval expiry,
- replay protection.

İstemci bu kontrollerin yerine geçmez.

## Secret ve veri sınırı

UI aşağıdakileri okumaz veya saklamaz:

- `GITHUB_TOKEN`,
- write bearer token,
- HttpOnly cloud-session cookie değeri,
- approval secret,
- owner HMAC key,
- Redis credential,
- OAuth/provider secret.

Form state ve approval token yalnız çalışan sayfanın belleğinde tutulur. `localStorage`, `sessionStorage`, IndexedDB veya clipboard kullanılmaz.

## Ağ sınırı

Yalnız iki same-origin JSON POST yolu vardır:

- `/api/github/write/prepare`
- `/api/github/write/execute`

İstekler `credentials: same-origin` ve `cache: no-store` kullanır. UI doğrudan GitHub API'sine bağlanmaz.

## Yan etki kapsamı

Bu modül yalnız `pr.create` üretebilir. Şunları üretemez:

- branch oluşturma,
- file update,
- merge,
- repository silme,
- workflow değiştirme,
- secret okuma.

Branch oluşturma ayrı mevcut kullanıcı akışıdır; merge ayrıca exact-head approval gerektiren farklı bir operasyondur.

## Erişilebilirlik ve lifecycle

Form gerçek `button`, `input` ve `form` öğeleri kullanır. Durum metni `aria-live=polite` ile bildirilir. Escape yalnız form busy değilken kapatır. Dinamik GitHub readiness kartı en fazla 10 saniye bounded MutationObserver ile beklenir; mount veya timeout sonrası observer/timer temizlenir.

Mobilde ana eylemler en az 44px touch target kullanır. Reduced-motion ve forced-colors modları desteklenir.

## Geri alma

Revert için `github-draft-pr-create.js`, CSS/style-loader, testler, bu belge ve chat-run/PWA wiring'i kaldırılır. Backend GitHub write runtime veya kalıcı repository state için migration yoktur.
