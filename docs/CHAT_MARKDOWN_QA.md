# Chat Markdown QA Playbook

## Smoke 1 — Plain text

Yeni sohbet açılır. Kısa bir assistant cevabı alınır. Cevap paragraf olarak görünmeli; özel syntax olmayan metin anlamını değiştirmemelidir.

## Smoke 2 — Formatting

Başlık, kalın, eğik, üstü çizili ve inline code içeren cevap üretilir. Görsel hiyerarşi okunabilir kalmalı; kullanıcı mesajı aynı kaldığı için kendi input'u biçimlenmemelidir.

## Smoke 3 — Lists

Ordered, unordered ve task list üretilir. Ordered list başlangıç sayısı korunmalı. Task marker tıklanabilir bir kontrol gibi davranmamalı.

## Smoke 4 — Code

Bir JavaScript, JSON veya Python code block üretilir. Dil etiketi görünür. Code içerikleri HTML olarak çalışmamalı. Kopyalama düğmesi yalnız code text'i kopyalamalıdır.

## Smoke 5 — Tables

Geniş bir pipe table oluştur. Desktop'ta tamamı okunabilmeli, mobile'da container içinde yatay scroll oluşmalıdır. Body genel genişliği taşmamalıdır.

## Smoke 6 — Links

HTTP/HTTPS ve mailto linkleri tıkla. `javascript:`, `data:`, `vbscript:`, relative ve protocol-relative örnekleri üret; bunların hiçbiri tıklanabilir anchor olmamalıdır.

## Smoke 7 — Streaming

Uzun bir cevabı streaming ile üret. Kapanmamış code fence ara durumda code block olarak kalabilir. Son delta geldiğinde final biçim görünmeli. Console'da observer loop veya uncaught exception olmamalıdır.

## Smoke 8 — Performance

64 KiB'e yaklaşan cevap ve uzun inline marker satırı test edilir. UI'nun input yüzünden sonsuz büyümediği ve parser'ın bounded kaldığı doğrulanır.

## Smoke 9 — Accessibility

Keyboard ile code-copy butonuna ulaş. Focus görünür olmalı. Reduced-motion ve forced-colors ortamında kontrol sınırları okunabilir kalmalı.

## Smoke 10 — PWA

Service worker aktifken reload yapılır. Markdown CSS/JS shell'den erişilebilir olmalı. Offline navigation shell çalışmalı; API response'ları cache'ten okunmamalıdır.

## Fail response

Security testi fail ederse feature release edilmez. Parser yanlış bir linki clickable hale getiriyorsa allowlist incelenir. Observer loop görülürse source equality ve writing guard geri kontrol edilir. PWA yalnız asset cache eksikliği nedeniyle fail ediyorsa shell revision ve asset listesi karşılaştırılır.
