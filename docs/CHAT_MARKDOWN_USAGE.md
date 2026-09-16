# Chat Markdown — Kullanım ve Operasyon

Markdown katmanı yalnız asistan mesajlarının sunumunu değiştirir; conversation storage biçimini değiştirmez.

## Kullanıcı davranışı

Asistan yanıtlarında başlık, liste, alıntı, tablo, vurgu ve kod blokları biçimlendirilir. Kod bloklarında kopyalama eylemi bulunur. Kullanıcı mesajları düz metin olarak kalır.

## Streaming

Akış parçaları animation frame içinde birleştirilir. Yanıt tamamlandığında bekleyen render iptal edilerek son kaynak kesin biçimde çizilir.

## Güvenlik

HTML çalıştırılmaz. Link şemaları allowlist ile sınırlıdır. Renderer dış ağa erişmez ve remote image yüklemez.

## Operasyon

Renderer yüklenmezse `app.js` text-only fallback'i çalışır. Bootstrap bir sayfa oturumunda aynı varlığı ikinci kez yüklemez. Sorun giderme sırasında önce `chat-markdown` script ve CSS yükleme durumuna, sonra renderer hata sınırlarına bakılır.

## Geri alma

Bootstrap bloğu kaldırılır; conversation history ve backend API'leri değişmeden kalır.
