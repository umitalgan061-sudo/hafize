# Markdown operasyon runbook

## Belirti: mesajlar biçimlenmiyor

Önce `HafizeMarkdown` globalinin oluşup oluşmadığını kontrol et.

Ardından `message-markdown-enhancement.js` dosyasının yüklendiğini kontrol et.

Renderer yüklenmediyse ana sohbetin plain-text davranışı beklenen fallback'tir.

## Belirti: kod kopyalanmıyor

Clipboard API'nin mevcut olup olmadığını kontrol et.

Tarayıcı izin reddi varsa status mesajı görülmelidir.

Bu hata sohbet gönderimini etkilememelidir.

## Belirti: link çalışmıyor

Yalnız http, https ve mailto protokolleri desteklenir.

Geçersiz şema bilinçli olarak linke çevrilmez.

## Belirti: uzun yanıt yavaş

24.000 karakter sınırı ve 240 blok sınırı nedeniyle sınırsız parse beklenmez.

MutationObserver'ın yalnız `#messages` ağacını gözlediğini doğrula.

Aynı kaynak için `data-markdown-source` değerinin değişmediğini kontrol et.

## Belirti: PWA eski davranışı gösteriyor

Service worker cache sürümünü kontrol et.

Renderer değişikliğinde shell cache sürümü artırılmalıdır.

## Debug sırası

1. Browser console'da JavaScript syntax/runtime hatalarını kontrol et.
2. Network'te markdown assetlerinin 200 veya cache hit olduğunu doğrula.
3. `#messages .message.assistant .content` düğümünü incele.
4. `data-markdown-source` attribute'unu kontrol et.
5. Gerekirse enhancement scriptini tek başına devre dışı bırakıp plain-text fallback'i doğrula.

## Güvenlik olayı

Beklenmeyen HTML çalışması görülürse Markdown enhancement katmanını disable et.

Storage kayıtlarını silme.

Renderer kaynak ve güvenlik testlerini çalıştır.

Yeni davranış eklemeden önce allowlist ve DOM oluşturma modelini gözden geçir.

## Rollback

En güvenli geri alma yolu ilgili PR'ı revert etmektir.

Sohbet geçmişi ham metin tuttuğu için rollback veri migrasyonu gerektirmez.
