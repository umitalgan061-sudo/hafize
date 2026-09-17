# Prompt Collection Workspace — Klavye Haritası

## Global

`Ctrl/⌘ + Shift + L` koleksiyon aramasına odaklanır.

Kısayol yalnızca düzenlenebilir bir kontrol odakta değilken çalışır.

Arama alanında mevcut değer seçilir.

Bu sayede kullanıcı doğrudan metin yazmaya başlayabilir.

## Satır odağı

Koleksiyon satırları tab sırasına alınabilir.

`ArrowUp` görünür önceki satıra geçer.

`ArrowDown` görünür sonraki satıra geçer.

Ok tuşları liste sınırlarını aşmaz.

`Enter` odaktaki koleksiyonu açar veya kapatır.

`F` favori durumunu değiştirir.

`A` arşiv durumunu değiştirir.

`Delete` silme onayı başlatır.

## Escape

Aktif koleksiyon ayrıntısı açıkken Escape ayrıntıyı kapatır.

Düzenleyici açıkken Escape düzenleyiciyi kapatır.

Modal kapandığında önceki odak geri yüklenir.

## Modal

Tab odağı modal içindeki kontrollere sınırlar.

Shift+Tab ters yönde döner.

Son kontrol sonrası Tab ilk kontrole döner.

İlk kontrol üzerinde Shift+Tab son kontrole döner.

Devre dışı kontroller focusable listesine alınmaz.

## Komut mantığı

Klavye eylemleri mouse eylemleriyle aynı action fonksiyonlarını kullanır.

Bu sayede klavye ile yapılan state değişiklikleri ayrı bir veri yolu oluşturmaz.

Favori ve arşiv eylemleri aynı metadata storage'ına yazılır.

Delete aynı kullanıcı onay mekanizmasını kullanır.

## Edit alanları

Input, textarea ve select odaktayken satır kısayolları çalışmaz.

Contenteditable alanlar da klavye guard kapsamındadır.

Ctrl/⌘+Shift+L form alanında iken arama davranışını ele geçirmez.

Form gönderme native submit davranışıyla değil kontrollü handler ile yapılır.

## Mobil

Dokunmatik cihazlarda aynı eylemler butonlarla kullanılabilir.

Klavye map mobil erişilebilirlik için opsiyoneldir.

Kısayolların görünür buton eşleri korunur.

## Test matrisi

Kısayol testi modifier kontrolünü doğrular.

Satır testi Enter eylemini doğrular.

Favori testi F eylemini doğrular.

Arşiv testi A eylemini doğrular.

Delete testi onay gereksinimini doğrular.

Escape testi modal ve ayrıntı kapanışını doğrular.

Odak testi yukarı/aşağı hareketini doğrular.
