# Conversation Outline Contract

## Amaç

Sohbet taslağı uzun Hafize konuşmalarında kullanıcının kendi turlarını hızlıca bulup ilgili mesaja dönmesini sağlar. Özellik yeni bir konuşma veritabanı oluşturmaz; yalnız açık sohbetin zaten render edilmiş DOM görünümünden geçici bir içindekiler listesi türetir.

## Kaynak sınırı

Taslak corpus'u yalnız `#messages .message.user[data-message-id] .content` düğümlerinden oluşur. Hafize yanıtları, tool activity, trace, ajan/model metadata'sı, kişisel bellek, Gmail, GitHub veya schedule verisi indekslenmez.

Her öğe yalnız çalışma belleğinde şu alanları taşır:

- doğrulanmış mesaj kimliği,
- en fazla 92 karakterlik tek satıra normalize edilmiş geçici önizleme,
- açık sohbetteki sıra numarası.

En fazla 100 kullanıcı turu listelenir. Mesaj kimliği en fazla 160 karakterdir ve yalnız açık allowlist karakterlerini kabul eder.

## Kalıcılık ve ağ

Bu modül `localStorage`, `sessionStorage`, cookie, IndexedDB veya backend kullanmaz. Arama sorgusu, önizleme metni ve panel açık/kapalı durumu sayfa yenilemesinden sonra saklanmaz.

`fetch`, XHR, WebSocket, EventSource, sendBeacon veya connector çağrısı yoktur. Yeni endpoint veya tool permission eklenmez.

## Arama

Panel içindeki arama yalnız oluşturulmuş geçici önizlemeler üzerinde çalışır. Sorgu en fazla 120 karakterdir, Türkçe locale ile küçük harfe normalize edilir ve storage'a yazılmaz. Eşleşme yoksa mesajlar silinmez veya değiştirilmez; yalnız panelde boş durum gösterilir.

## Gezinme

Bir taslak öğesine tıklamak exact doğrulanmış mesaj kimliğini açık sohbet DOM'unda tekrar arar. Hedef hâlâ mevcutsa focus verilir ve görünür alanın ortasına kaydırılır. Hedef re-render nedeniyle yoksa işlem fail-closed durur ve liste yeniden hesaplanır.

Gezinme mesaj içeriğini değiştirmez, form submit etmez ve sohbet seçimini değiştirmez. Reduced-motion tercihinde smooth scroll kullanılmaz.

## Erişilebilirlik

- Açma kontrolü native `button` ve `aria-haspopup=dialog` kullanır.
- Panel `role=dialog`, görünür başlık ve polite durum metni taşır.
- Escape paneli kapatıp odağı açma düğmesine döndürür.
- Panel dışına açık pointer etkileşimi paneli kapatır fakat odağı zorla taşımaz.
- Arama alanı sonuç listesini `aria-controls` ile işaret eder.
- Mobil hedefler en az 40-52px aralığında tutulur.
- Forced-colors ve reduced-motion tercihleri korunur.

## Streaming ve lifecycle

`MutationObserver` yalnız mesaj DOM'undaki child/text değişikliklerini izler. Güncelleme `requestAnimationFrame` ile tek render kuyruğunda birleştirilir. Streaming sırasında yeni kullanıcı turu oluşursa veya DOM yeniden render edilirse taslak yeniden türetilir.

`destroy()` observer ve global listener'ları kaldırır, oluşturduğu trigger/panel düğümlerini siler ve geçici hedef vurgusunu temizler.

## Güvenlik sınırı

Modül mesaj metnini HTML olarak parse etmez; önizlemeyi `textContent` ile yazar. Kullanıcı/model içeriğinden selector, URL, script path, network hedefi veya komut üretilmez.

Backend default-deny tool policy, external write/send/merge approval, provider boundary, secret isolation ve dört profilli selector/specialist roster değişmez.

## Geri alma

Revert için `conversation-outline.js`, `conversation-outline.css`, testler, bu sözleşme ve loader/PWA policy kayıtları kaldırılır. Server veya persistent conversation schema migrasyonu yoktur.
