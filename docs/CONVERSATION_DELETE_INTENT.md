# Conversation delete intent contract

Bireysel sohbet silme işlemi geri alınamaz yerel veri kaybı oluşturduğu için tek yanlış dokunuşla çalışmamalıdır. Hafize bu işlemi tarayıcının blocking `confirm()` penceresine bırakmak yerine aynı silme düğmesi üzerinde iki ayrı kullanıcı eylemiyle doğrular.

## Akış

1. İlk `×` tıklaması silme işlemini durdurur.
2. Düğme `Sil?` durumuna geçer, `aria-pressed=true` olur ve konuşma başlığını içeren açık bir onay etiketi alır.
3. Kullanıcı aynı düğmeye 8 saniye içinde ikinci kez basarsa mevcut uygulama silme handler'ı çalışabilir.
4. Süre dolarsa, Escape basılırsa, odak başka yere taşınırsa, başka bir yere tıklanırsa veya sekme arka plana geçerse pending intent iptal edilir.

Aktif konuşmada gönderilmemiş composer taslağı varsa mevcut draft-navigation guard önceliğini korur; delete intent onun önüne geçmez.

## Neden native confirm kullanılmıyor?

Blocking browser dialog'ları platforma göre farklı davranır, erişilebilirlik ve mobil UX üzerinde daha az kontrol sunar ve bazı ortamlarda bastırılabilir. Inline iki-aşamalı intent aynı görünür UI yüzeyinde çalışır ve Hafize'nin mobil/masaüstü davranışını daha tutarlı yapar.

## Güvenlik ve veri sınırı

- İlk eylem hiçbir localStorage write veya silme çağrısı üretmez.
- Modül conversation içeriğini, message gövdelerini, token/cookie/credential değerlerini okumaz.
- Network isteği, backend endpoint, clipboard veya storage alanı eklenmez.
- Pending intent yalnız sayfa belleğinde ve en fazla 8 saniye yaşar.
- İkinci eylem yalnız mevcut `app.js` delete handler'ına geçiş izni verir; modül kendi başına storage silmez.
- Streaming sırasında silmeyi engelleyen mevcut `app.js` kontrolü aynen kalır.

## PWA

`conversation-delete-confirm.js` mevcut shell asset'tir. Davranış güncellemesinin kurulu PWA'lara ulaşması için shell cache sürümü v91'e yükseltilir. `/api/*` istekleri network-only kalır.

## Test beklentileri

Regresyonlar ilk tıklamada propagation'ın durmasını, ikinci tıklamada izin verilmesini, 8 saniyelik timeout'u, Escape/focus/visibility/outside-click iptalini, draft guard önceliğini, native `confirm()` kullanımının kaldırılmasını ve forbidden network/storage yüzeylerini kapsar.