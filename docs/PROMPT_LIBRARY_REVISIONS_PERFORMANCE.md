# Revision History Performance

## Storage scale

Prompt başına 10 revision ve toplam 120 prompt sınırı, local storage okuma/normalizasyon maliyetini bounded tutar.

## Read path

`list(promptId)` yalnız ilgili prompt id'sine ait revision array'ini döndürür. UI her render'da tüm map'i yalnız normalize edilmiş şekilde okur; bounded data nedeniyle maliyet öngörülebilirdir.

## Render

Bir panelde en fazla 10 revision satırı gösterilir. Preview içerikleri 260 karakter, current/comparison alanları 2000 karakter ile sınırlandırılır.

## MutationObserver

Revision observer yalnız Prompt Library card subtree'sinde çalışır ve sadece yeni prompt satırlarına `Geçmiş` action'ı ekler. Sonsuz observer zinciri oluşturmaz; mevcut action tekrar eklenmez.

## Event handling

Storage değişikliklerinde yalnız aktif panel açıkken yeniden render yapılır. Panel kapalıyken revision verisi için UI işi yapılmaz.

## Export

Export önce JSON string üretir ve 1 MB sınırını kontrol eder. Büyük veri durumunda yalnız en yeni 5 revision ile bounded fallback kullanılır.

## Memory

Panel kapandığında revision listesi ve comparison DOM'u `replaceChildren()` ile temizlenir. Destroy observer ve listener'ları kaldırır.

## Mobile

Preview'ler overflow scroll kullanır; uzun metin layout'u yatay taşırmaz.

## No telemetry

Performance analytics veya remote measurement yapılmaz. Bu modül kişisel local utility olarak tasarlanmıştır.

## Test önerisi

QA sırasında 120 prompt ve prompt başına 10 revision ile panel açma, restore ve clear işlemlerinin UI'da belirgin gecikme yaratmadığı gözlenmelidir.
