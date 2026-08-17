# GitHub Branch Create UI Contract

## Amaç

Bu yüzey, Hafize'nin mevcut GitHub write approval runtime'ını yalnız kendi deposunda güvenli bir `branch.create` işlemi için görünür hale getirir. Yeni bir GitHub yetkisi veya alternatif yazma yolu açmaz.

## Sabit kapsam

İstemci yalnız `umitalgan061-sudo/hafize` deposunu hedefler ve yalnız `branch.create` komutu oluşturabilir. Branch adı `hafize/` önekiyle başlamak zorundadır. UI `file.update`, `pr.create` veya `pr.merge` komutu üretmez.

Branch suffix en fazla 90 karakterdir ve dar alfanümerik/ref karakter allowlist'i kullanır. Base ref en fazla 120 karakterdir. `..`, `//`, boş veya slash ile biten değerler ağ isteğinden önce reddedilir.

## İki aşamalı açık kullanıcı onayı

İşlem tek tıklamayla yürütülmez.

1. Kullanıcı branch ve base ref değerini girip `Onayı hazırla` düğmesine basar.
2. İstemci exact komutu `POST /api/github/write/prepare` yoluna gönderir.
3. Sunucunun döndürdüğü normalized komut istemcinin exact komutuyla tekrar karşılaştırılır.
4. Approval token biçimi ve expiry sınırı doğrulanır.
5. Ancak bundan sonra ayrı `Onayla ve oluştur` düğmesi görünür.
6. Kullanıcı ikinci düğmeye basarsa aynı normalized komut ve approval token `POST /api/github/write/execute` yoluna gönderilir.

Branch veya base ref onay hazırlandıktan sonra değişirse approval state anında silinir. Approval süresi dolmuşsa execute yapılmaz.

## Backend karar mercii

İstemci authorization kararı vermez. Backend hâlâ:

- privileged principal authentication,
- connector owner türetme,
- repository allowlist,
- `hafize/` branch prefix,
- command normalization,
- kısa ömürlü HMAC approval token,
- exact command digest eşleşmesi,
- principal/owner eşleşmesi,
- Redis replay claim,
- GitHub provider execution

sınırlarını uygular.

Cloud-session cookie HttpOnly kalır. Bearer token, GitHub token, approval secret, owner key, Redis credential veya başka secret renderer'a verilmez.

## Veri ve tarayıcı sınırı

Form ve approval state yalnız bellektedir. `localStorage`, `sessionStorage`, IndexedDB, cookie okuma/yazma veya clipboard kullanılmaz. İstekler `credentials: same-origin` ve `cache: no-store` ile yalnız iki same-origin API endpoint'ine yapılır.

UI `innerHTML` kullanmaz; branch/ref ve status metinleri `textContent` ile gösterilir. WebSocket, EventSource veya sendBeacon yoktur.

## Erişilebilirlik ve lifecycle

Form `aria-expanded`, polite status ve gerçek button/input öğeleri kullanır. Escape, işlem busy değilken formu kapatır ve odağı toggle düğmesine geri verir. Mobilde temel etkileşim hedefleri en az 44px'tir. Reduced-motion ve forced-colors stilleri korunur.

GitHub readiness kartı dinamik yüklendiği için controller en fazla 10 saniye bounded MutationObserver ile kartı bekler. Mount veya timeout sonrası observer/timer temizlenir. `destroy()` aktif isteği abort eder, listener'ları kaldırır ve üretilmiş DOM'u temizler.

## Geri alma

Revert için `github-branch-create.js`, style loader/CSS, testler, bu sözleşme, chat-run loader satırları ve PWA v70 asset kayıtları kaldırılır. GitHub backend write runtime, approval token şeması veya persistent veri için migration gerekmez.
