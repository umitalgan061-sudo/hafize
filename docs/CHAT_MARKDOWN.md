# Sohbet Markdown Render

Asistan yanıtları, modelin ürettiği Markdown kaynağı korunarak güvenli DOM düğümlerine çizilir.

## Kapsam

- Başlıklar, paragraflar, listeler, alıntılar ve yatay çizgiler.
- Çitli kod blokları ve satır içi kod.
- Güvenli bağlantılar, kaçışlar ve temel GFM tabloları.
- `assistant` mesajlarında render; kullanıcı mesajları düz metin kalır.
- Streaming sırasında frame birleştirme ve tamamlanmış yanıtta son boyama.
- Kod bloklarında kopyalama eylemi.

## Güvenlik

Model çıktısı güvenilmeyen metindir. Renderer HTML string çalıştırmaz; `createElement`, `createTextNode` ve `textContent` kullanır. `javascript:`, `data:` ve göreli hedefler bağlantı olarak etkinleşmez. İç içe yapı, satır ve metin uzunlukları bounded tutulur.

## Veri akışı

`app.js` kaynak yanıtı local conversation history içinde düz metin olarak saklar. Markdown katmanı yalnız görünümü değiştirir. Mesaj çalışma alanı ve sesli çıktı, kaynak metin sözleşmesini tüketmeye devam eder.

## Yükleme

Mevcut Prompt Library revision-enhancer bootstrap'ı, sayfaya sabit `/chat-markdown.css`, `/markdown-renderer.js` ve `/chat-markdown.js` varlıklarını bir kez yükler. Bu, güncel `index.html` ve PWA shell listesindeki daha yeni typed/runtime varlıklarını değiştirmez.

## Geri alma

Bootstrap'ın Markdown loader bloğunu kaldırmak görünümü eski düz metin davranışına döndürür. Conversation storage ve backend sözleşmesi değişmez.
