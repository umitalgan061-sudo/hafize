# Text File Import Explicit Review

## Amaç

Hafize'nin `＋` dosya ekleme akışı küçük metin ve kod dosyalarını sohbet composer'ına ekler. Bu sözleşme, dosya seçiminin tek başına composer içeriğini değiştirmemesini ve kullanıcının dosyaları eklemeden önce açıkça inceleyebilmesini garanti eder.

## İki aşamalı akış

1. Kullanıcı `＋` düğmesine basar ve en fazla dört dosya seçer.
2. Dosyalar yalnız sayfa belleğinde okunur ve geçici inceleme panelinde ad, boyut, karakter sayısı ve bounded düz metin önizlemesiyle gösterilir.
3. Kullanıcı isterse tek tek dosyaları listeden kaldırabilir veya tüm işlemi iptal edebilir.
4. Composer yalnız ayrı `Yazara ekle` düğmesine basıldığında değiştirilir.
5. Composer'a eklenen metin yine normal mesaj taslağıdır; gönderim için ayrıca standart sohbet gönderme eylemi gerekir.

## Sınırlar

- Tek seçimde en fazla **4 dosya**.
- Dosya başına en fazla **128 KiB**.
- Composer toplamı en fazla **12.000 karakter**.
- Görünür dosya önizlemesi en fazla **180 karakter**.
- Destek yalnız bounded metin/kod uzantıları ve metin MIME türleriyle sınırlıdır.
- Geç gelen async dosya okumaları generation kontrolüyle stale staging'e yazamaz.

## Veri ve güvenlik sınırı

Dosya içeriği `localStorage`, `sessionStorage`, IndexedDB, cookie, clipboard, backend veya connector'a yazılmaz. Import modülü `fetch`, XHR, WebSocket, EventSource veya sendBeacon kullanmaz. Dosyalar yalnız tarayıcının kullanıcı tarafından açılan file picker'ından gelir.

Dosya adı normalize edilir; path separator ve kontrol karakterleri güvenli label'a çevrilir. Dosya metni HTML olarak parse edilmez. Review satırlarında kullanıcı dosya adı ve dosya içeriği yalnız `textContent` üzerinden gösterilir.

Bu özellik agent tool permission, NVIDIA provider routing, memory, Gmail, Canva veya GitHub write yetkisini değiştirmez. Import edilen metin ancak kullanıcı normal composer submit'i yaptığında mevcut sohbet/agent güvenlik sınırlarına girer.

## Streaming davranışı

Aktif assistant streaming sırasında yeni dosya seçimi ve staging fail-closed engellenir. Daha önce stage edilmiş dosyalar streaming sırasında composer'a eklenemez. Escape veya `Vazgeç` pending staging'i temizler.

## Erişilebilirlik

Review paneli görünür bir başlık, polite status ve gerçek button kontrolleri kullanır. Mobil kontroller en az 44 px dokunma hedefidir. Focus-visible, reduced-motion ve forced-colors davranışları korunur.

## Geri alma

Revert için `text-file-import.js` önceki tek-dosya davranışına döndürülür; review CSS/style loader, yeni testler, bu sözleşme ve PWA v79 wiring kaldırılır. Persistent veri veya server schema migrasyonu yoktur.
