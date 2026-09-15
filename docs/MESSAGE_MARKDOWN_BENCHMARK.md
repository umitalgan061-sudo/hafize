# Markdown benchmark prosedürü

## Amaç

Renderer'ın bounded input altında kabul edilebilir DOM ve CPU davranışını doğrulamaktır.

## Senaryolar

1 KB plain text.

8 KB Markdown.

24 KB mixed Markdown.

100 satırlık code fence.

240 blok sınırı.

20 heading outline.

Tablo + task list kombinasyonu.

## Ölçümler

İlk render süresi.

Mutation sonrası yeniden render süresi.

Oluşan DOM node sayısı.

Observer callback sayısı.

Memory profiler'da detached node gözlenmemesi.

## Beklenen davranış

24 KB üstünde parse büyümemelidir.

240 blok üstünde sınırsız DOM oluşmamalıdır.

Aynı `data-markdown-source` değerinde tekrar render yapılmamalıdır.

Uzun code block sayfayı dikey olarak sonsuza büyütmemelidir.

## Streaming

Kısa delta serileri ile tam yanıt karşılaştırılır.

Final metin aynı olduğunda görsel sonuç aynı olmalıdır.

## Mobil

400 px civarı genişlikte horizontal page overflow oluşmamalıdır.

Code/table overflow kendi container'larında kalmalıdır.

## PWA

Cold load ve cached load karşılaştırılır.

v36 shell assets eksiksiz olmalıdır.

## Regression

Benchmark sonrası conversation export, search ve message workspace davranışları kontrol edilir.

## Sign-off

Ölçüm sonuçları PR yorumunda kaydedilir.

Kritik frame drop veya kontrolsüz node büyümesi release blocker'dır.
