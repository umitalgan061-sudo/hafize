# Streaming Markdown Davranışı

## Başlangıç

`app.js` assistant mesajı için boş content node'u oluşturabilir. Markdown observer bu node'u ancak içerik oluştuğunda işler. Boş node'da gereksiz DOM tree kurulmaz.

## İlk delta

İlk metin delta'sı geldiğinde observer source değeri kaydeder ve parser çalışır. Kaynak fenced code başlangıcıysa kapanmamış code block çizilir. Bu ara durum geçerlidir.

## Sonraki delta

Yeni delta source'u değiştirirse observer yeniden tarama planlar. Aynı tick'teki çoklu mutation'lar queueMicrotask yoluyla tek taramaya sıkıştırılır. Bu, her karakter için bağımsız DOM renderı yapılmasını engeller.

## Kapanış

Fence kapanırsa parser code block'u `closed=true` ile üretir. Renderer DOM'da code text'i günceller. Dil etiketi sabit kalır veya yeni kaynakla güvenli şekilde normalize edilir.

## Edit

Kullanıcı eski bir mesajı düzenlediğinde `app.js` conversation state'ini değiştirir ve yeniden render edebilir. Markdown modülü storage'a dokunmadığı için eski assistant DOM state'i kalıcı veri olarak konuşmaya yazılmaz.

## Retry

Retry yeni assistant output ürettiğinde aynı observer lifecycle devreye girer. Eski `markdownSource` karşılaştırması farklı message node'ları arasında paylaşılmaz.

## Stop

Akış durdurulduğunda gelen kısım mevcut content olarak kalabilir. Renderer metni yalnız presentation olarak işler; stop kararını veya streaming controller'ı sahiplenmez.

## Hata

Parser hata atmamalıdır. Geçersiz veya eksik fence, URL veya syntax düz text fallback üretir. Clipboard hatası model output'u başarısız saymaz.

## Lifecycle

Observer `install()` ile başlar. Aynı messages elementine ikinci kurulum yapılmaz. `disconnect()` çağrısı observer'ı kapatır. Sayfa unload olduğunda browser document lifecycle zaten bunu sonlandırır.

## Performans

Parser limitleri streaming sırasında da geçerlidir. Girdi 64 KiB sınırında kesilir, inline uzun satır düz text olur, tablo/list/code node sayıları bounded kalır.
