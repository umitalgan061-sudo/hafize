# Chat Markdown Performans Sözleşmesi

## Ana risk

Streaming cevaplar küçük delta'larla sık sık değişebilir. Renderer her değişiklikte tüm mesajı yeniden işler. Bu nedenle parser'ın girdisini bounded tutmak yalnız bellek güvenliği değil UI akıcılığı için de gereklidir.

## Limitler

Input 64 KiB, blok 350, liste 240 öğe, tablo 120 satır ve 16 sütun, inline 4 KiB ve code 2000 satır ile sınırlıdır. Limitler birbirinden bağımsızdır; tek bir uzun bölüm tüm parser bütçesini tüketmemelidir.

## Inline koruması

Uzun ve eşleşmeyen emphasis marker dizileri normal parser algoritmalarını pahalı hâle getirebilir. 4 KiB üstü tek satır doğrudan text span olarak bırakılır. Bu durumda kullanıcı içeriği kaybolmaz; yalnız zengin biçimlendirme o satır için devre dışı kalır.

## Observer

MutationObserver kendi render'ının ürettiği DOM mutation'larını da görebilir. `markdownSource` aynı içeriği yeniden işlemekten kaçınır; `markdownWriting` guard'ı render sırasında re-entrant işlenmeyi engeller; microtask scheduling aynı frame içindeki çok sayıda mutation'ı bir taramaya yaklaştırır.

## Büyük tablolar

Tablo satır ve sütun limitleri, DOM node sayısını bounded tutar. CSS table wrapper yatay scroll kullanır; global body width büyütülmez.

## Büyük kod blokları

Code block ham text olarak tek `code` node'una yazılır. Syntax highlighting yapılmaz; böylece üçüncü taraf tokenizer maliyeti ve ek XSS yüzeyi oluşmaz. Dil etiketi yalnız küçük bir güvenli sınıfa dönüşür.

## Ölçüm yaklaşımı

Değişiklik sırasında parser testleri normal örnekleri ve maksimum sınırları çalıştırmalıdır. Üretim telemetry bu modülde bilinçli olarak yoktur; renderer kullanıcı metnini uzak servise göndermez. Gerçek darboğaz görüldüğünde önce input shape'i küçültülür, limit körlemesine artırılmaz.
