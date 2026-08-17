# GitHub Write Activity Contract

## Amaç

Hafize'nin kullanıcı onaylı GitHub yazma yüzeyleri tamamlanan işlemler için görünür bir oturum içi etkinlik özeti sunar. Bu görünüm bir audit veritabanı, kalıcı görev ledger'ı veya GitHub geçmişi değildir; yalnız açık sayfa oturumunda kullanıcıya son işlemlerin sonucunu hatırlatır.

## Kaynak olaylar

Controller yalnız allowlist içindeki üç event adını kabul eder:

- `hafize:github-branch-created`
- `hafize:github-draft-pr-created`
- `hafize:github-file-updated`

Canlı mevcut producer'lar draft PR ve file-update yüzeyleridir. Branch event şeması da aynı fail-closed normalizasyon katmanında tanımlıdır; başka event adları yok sayılır.

Etkinlik görünümü başarı event'i üretmez, GitHub write endpoint'i çağırmaz ve write sonucunu kendisi tahmin etmez. Yalnız ilgili write controller'ın backend sonucunu doğruladıktan sonra yayınladığı olayları tüketir.

## Veri minimizasyonu

En fazla 12 kayıt yalnız JavaScript belleğinde tutulur. Sayfa yenilenince kayıtlar kaybolur. Kullanıcı `Temizle` ile mevcut listeyi istediği anda sıfırlayabilir.

Kabul edilen alanlar yalnız şunlardır:

- branch: `hafize/` prefix'li, 120 karakteri aşmayan doğrulanmış ref;
- draft PR: pozitif ve bounded PR numarası;
- file update: güvenli repo-relative path ve `hafize/` branch.

Approval token, bearer token, cookie, ownerId, traceId, commit SHA, blob SHA, dosya içeriği, PR body, commit mesajı veya OAuth credential etkinlik kaydına alınmaz. Event detail fazladan alan taşısa bile normalize edilmiş kayıt bunları kopyalamaz.

## Ağ ve storage sınırı

`github-write-activity.js` şunları kullanmaz:

- `fetch`, XHR, WebSocket, EventSource veya sendBeacon;
- localStorage, sessionStorage, IndexedDB veya cookie API;
- clipboard;
- doğrudan `api.github.com` çağrısı.

Dolayısıyla bu özellik kendi başına yeni bir network, connector veya GitHub permission yüzeyi oluşturmaz.

## Güvenlik

Bu görünüm yalnız sunum katmanıdır. GitHub yazma güvenliği mevcut backend sınırında kalır:

- repository ve branch allowlist;
- exact command approval;
- kısa ömürlü approval token;
- principal/owner eşleşmesi;
- replay koruması;
- sensitive path blokları;
- merge ve diğer yüksek etkili işlemlerin ayrı onayı.

Etkinlik görünümünün varlığı bu kontrollerden hiçbirini atlamaz veya genişletmez.

## Render güvenliği

Tüm metin DOM'a `textContent` ile yazılır. HTML parse veya `innerHTML` yoktur. Branch/path/PR numarası render edilmeden önce bounded allowlist doğrulamasından geçer.

## Erişilebilirlik ve mobil

Panel native button kullanır, `aria-expanded` ile açılma durumunu açıklar ve polite live status sağlar. Escape açık paneli kapatıp odağı toggle'a döndürür. Mobilde etkileşim hedefleri en az 44px tutulur. Reduced-motion ve forced-colors davranışları ayrıca tanımlıdır.

## Lifecycle

GitHub readiness kartı daha sonra mount olursa controller en fazla 10 saniyelik bounded MutationObserver ile bekler. Başarılı mount veya timeout sonrasında observer/timer temizlenir. `destroy()` tüm event listener'larını ve ürettiği DOM'u kaldırıp session-memory listesini sıfırlar.

## PWA

JS, style bootstrap ve CSS shell asset listesinde bulunur. Cache sürümü `hafize-shell-v73`'tür. `/api/*` GET istekleri network-only kalır; POST yazma çağrıları service-worker shell cache kapsamına girmez.

## Geri alma

Revert için `github-write-activity.js`, CSS/style bootstrap, testler, bu belge ve loader/PWA wiring kaldırılır. Backend GitHub write runtime'ında veya persistent veri şemasında migrasyon yoktur.
