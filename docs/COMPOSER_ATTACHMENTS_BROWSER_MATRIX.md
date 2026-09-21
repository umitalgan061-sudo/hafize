# Composer Ekleri — Browser Matrisi

## Chromium / Edge
File picker, File.text, drag-drop ve temel clipboard file akışı desteklenir.

## Firefox
File picker temel yoldur. Clipboard file desteği feature detection üzerinden opsiyoneldir.

## Safari
File picker temel yoldur. Drag-drop özellikle mobilde tarayıcı kabiliyetine bağlıdır.

## Mobil
Dokunmatik temel akıştır. Fiziksel klavye varsa Ctrl/Command + Shift + A desteklenir.

## Fallback
Dosya seç düğmesi her browser'da temel fallback'tir.

## Kabul
Her browser ailesinde panel açma, dosya seçme, preview, range, checkbox ve insert test edilir.

Clipboard ve drop desteklenmiyorsa bu bir feature failure değil, optional capability kabul edilir.