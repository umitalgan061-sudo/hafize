# Recurrence Browser Matrisi

## Chromium
datetime-local alanı native kontrol olarak kullanılır.
Checkbox haftalık gün seçimi standart input'tur.
History toggle button olarak çalışır.

## Safari
CSS grid mobil kırılımı tek kolon olur.
forced-colors bulunmayan platformda standart tema devam eder.
localStorage unavailable durumda preset işlemi graceful fail olur.

## Firefox
FileReader JSON import sınırı uygulanır.
Blob download export akışı tarayıcıya bırakılır.

## PWA
Recurrence UI asset'leri shell cache listesinde bulunur.
API response'ları cache'lenmez.
App shell offline açıldığında formsuz statik kabuk zarar görmez.

## Accessibility
Dialog mevcut görevler panelinde korunur.
Form field'larında aria-label bulunur.
Haftalık checkbox grubu aria group ile açıklanır.
History listesi metin tabanlıdır.
Focus-visible sınırları kaybolmaz.

## Reduced motion
Yeni CSS animasyon eklemez.
Mevcut reduced-motion kuralı korunur.

## Forced colors
Panel, preset satırları ve history sınırları CanvasText kullanır.
Metin sistem rengine uyum sağlar.

## Manual smoke
Paneli aç.
Günlük görev oluştur.
Haftalık iki gün seç.
Aylık 31 seç.
History toggle.
Preset oluştur ve kullan.
Preset export/import.
