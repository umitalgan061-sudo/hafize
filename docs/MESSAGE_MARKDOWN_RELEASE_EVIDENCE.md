# Markdown release evidence

## Renderer

Renderer tarayıcı tarafında çalışır ve harici runtime bağımlılığı gerektirmez.

Model metni DOM düğümleri üzerinden gösterilir.

URL dönüşümü sınırlı protokollerle yapılır.

## Features

Başlık, paragraf, liste, görev listesi, tablo, alıntı ve code fence işlenir.

Assistant yanıtında Kopyala, İndir, Alıntıla ve Ham metin kontrolleri bulunur.

Uzun yanıtlar ve uzun code block'lar görünüm olarak daraltılabilir.

Birden fazla başlıkta hızlı başlık özeti oluşturulur.

Biçimlendirme tercihi cihaz üzerinde on/off olarak tutulur.

## PWA

Renderer ve yardımcı UI assetleri shell cache listesine eklenmiştir.

Cache sürümü v36'dır.

API isteklerinin mevcut network-only kuralı korunur.

## Tests

Source, formatting, links, limits, DOM, streaming, fallback, PWA ve accessibility kontrolleri vardır.

Message actions ve outline için ayrı kontrol dosyaları vardır.

Runtime test gerçek renderer export'unu hafif DOM ile çalıştırır.

Consolidated suite temel Markdown testlerini tek giriş noktasında toplar.

## Operations

Runbook, rollback, failure modes, support, migration ve QA belgeleri mevcuttur.

## Privacy

Yeni özellikler için sunucu tarafı ölçüm endpoint'i eklenmemiştir.

Download ve quote işlemleri tarayıcı içindedir.

Preference yalnız local storage kullanır.

## Release

PR diff 3000 changed-line sınırını aşmamalıdır.

Tam repository kontrolü release ortamında ayrıca çalıştırılmalıdır.
