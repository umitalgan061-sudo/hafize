# Chat Markdown Tasarım Kaydı

## Katmanlar

Renderer dört küçük katmanda düşünülmelidir: normalize, parse, render ve interaction. Normalize girdiyi bounded hale getirir. Parse güvenli bir veri ağacı oluşturur. Render ağacı DOM'a çevirir. Interaction code-copy gibi kullanıcı tetiklemeli davranışları taşır.

Bu ayrım testleri de sadeleştirir. Parser DOM bilmez; renderer URL kararını tekrar vermek zorunda kalmaz; interaction parser içeriğini değiştirmez.

## Normalize

Input string değilse boş kabul edilir. Carriage-return biçimleri newline'a çevrilir ve NUL karakterleri düşürülür. 64 KiB sınırı parse aşamasından önce uygulanır. Bu, üst katmanların yanlışlıkla sınırsız string geçirmesi halinde bile parser bütçesini korur.

## Inline parser

Inline parser yalnız sınırlı token ailesini tanır. Code, link, strong, emphasis ve strike sırayla ayrılır. Tanınmayan içerik `text` span'ı olur. Uzun satırlar doğrudan text fallback'e girer.

Link tokenizer iki biçimi destekler: explicit Markdown link ve bare HTTPS/HTTP URL. Her ikisi sonunda `safeLinkHref` üzerinden aynı allowlist'ten geçer.

## Block parser

Fence önce kontrol edilir; code içindeki diğer block syntax literal kalır. Boş satır mevcut paragraph/list/quote state'ini flush eder. Table, header + separator çifti olmadan tanınmaz. Heading seviyesi maksimum 3 olur.

List state ordered/unordered olarak tutulur. Tip değiştiğinde önceki liste kapanır. Task syntax normal liste item'ından yalnız marker bilgisiyle ayrılır.

Quote satırları tek quote block içinde birleştirilir. Rule satırları ayrı bir horizontal rule olur.

## Renderer

Renderer bütün text'i `textContent` üzerinden node'a yazar. Anchor için URL property ve security relation kullanılır. Code text tek node içinde tutulur. Table cell içerikleri yeniden inline parser'dan geçer ancak raw HTML yine element üretmez.

## Observer

Observer `#messages` üzerinde subtree ve characterData değişikliklerini izler. Her mutation için doğrudan sync render yapılmaz; microtask scheduling kullanılır. Source değeri değişmediyse render atlanır. Render sırasında yazım flag'i kendi mutation'ını ignore eder.

## Storage bağımsızlığı

Renderer storage bilmez. Bu tasarım kararı sayesinde conversation/message workspace özellikleriyle ortak state oluşturulmaz. Raw source export/retry/edit için korunmaya devam eder.

## PWA

Asset'ler shell cache'e dahil edilir. Cache revision özelliğin dağıtım bir parçasıdır. API isteği shell kapsamına girmez.

## Değişmezler

- Asistan-only rendering.
- No HTML string sink.
- Link protocol allowlist.
- Bounded parser.
- No credential access.
- No network access.
- Copy action user initiated.
- User message source unchanged.
- Existing chat state owner unchanged.

## Gelecek işlerin sınırı

Syntax highlighting, nested block trees, images ve raw HTML ayrı tasarım kararlarıdır. Bunlar mevcut parser'ın içine sessizce eklenmemelidir; her biri ayrı güvenlik ve performans incelemesi gerektirir.
