# Sohbet okuma görünümü

`public/conversation-reading-controls.js`, aktif sohbetin yalnız görsel sunumunu kullanıcı kontrolünde değiştirir. Mesaj içeriğini, composer taslağını veya model/ajan seçimini değiştirmez.

## Bounded kontroller

Yazı boyutu allowlist'i `%90`, `%100`, `%110`, `%125` değerlerinden oluşur. Beklenmeyen değer `%100` varsayımına döner.

Satır aralığı allowlist'i `Sıkı`, `Normal`, `Ferah` seçeneklerinden oluşur. Beklenmeyen değer `Normal` varsayımına döner.

Seçimler yalnız `#messages` üzerindeki data attribute'larına uygulanır. Composer, topbar, form alanları ve tool kontrolleri ölçeklenmez.

## Odak modu

Topbar'daki görünür `Odak` düğmesi açık kullanıcı eylemiyle yardımcı araç rail'ini gizler ve sohbet sütununa daha fazla alan verir. Topbar, ajan/model kontrolleri ve composer görünür kalır. Aynı düğme `aria-pressed=true` durumuyla `Odaktan çık` kontrolüne dönüşür.

Odak modu klavye Escape davranışını ele geçirmez; mevcut streaming stop, modal ve sidebar Escape sözleşmeleriyle yarışmaz.

## Oturum ve güvenlik sınırı

Yazı boyutu, satır aralığı ve odak durumu session-only'dir. localStorage, sessionStorage, cookie veya backend'e yazılmaz. Sayfa yeniden yüklenince güvenli varsayılanlar geri gelir.

Controller network, clipboard, submit, tool veya connector çağrısı yapmaz. Agent registry, tool izinleri ve sohbet metni değişmez.

`destroy()` tüm oluşturduğu DOM kontrollerini ve focus sınıfını temizler; önceden var olan aynı ID'li kontrolleri yeniden kullanır ve onları silmez.

## PWA ve geri alma

JS/CSS shell asset olarak cache'lenir. Revert yalnız okuma kontrollerini, odak görünümünü, ilgili test/belgeyi ve cache sürümünü kaldırır; mesaj verisine dokunmaz.
