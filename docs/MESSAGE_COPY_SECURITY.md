# Hafize mesaj kopyalama güvenlik sözleşmesi

## Amaç

Sohbet mesajlarındaki görünür kullanıcı ve Hafize metnini tek tıklamayla panoya kopyalamak, Claude-benzeri temel mesaj işlemlerini Hafize'ye ekler.

Bu özellik yalnız tarayıcı tarafı bir UX katmanıdır. Ajan, model, connector veya backend tool yetkisi değildir.

## Açık kullanıcı niyeti

- Clipboard yazımı yalnız görünür `Kopyala` düğmesinin kullanıcı tarafından tıklanmasıyla başlar.
- Sayfa yüklenmesi, yeni mesaj gelmesi, rerender veya MutationObserver callback'i clipboard yazımı başlatmaz.
- Clipboard okuma yapılmaz.
- `document.execCommand` veya gizli textarea gibi legacy fallback kullanılmaz.

## Kopyalanan veri

- Yalnız mesajın `.content.textContent` değeri kopyalanır.
- Tool activity etiketleri, trace metadata, DOM attribute'ları veya görünmeyen HTML kopyaya eklenmez.
- HTML üretilmez ve `innerHTML` kullanılmaz.
- Boş mesaj ve 256 KiB üzerindeki tek mesaj fail-closed reddedilir.

## Browser sınırı

- `navigator.clipboard.writeText` yalnız secure context içinde kullanılır.
- Clipboard API mevcut değilse özellik hata durumunu görünür düğme etiketiyle bildirir ve alternatif geniş yetkili yol denemez.
- Provider/browser hata ayrıntısı kullanıcı mesajına yansıtılmaz.
- Clipboard yazımı dışında network isteği, storage yazımı veya credential erişimi yoktur.

## Render yaşam döngüsü

`app.js` mesaj listesini yeniden oluşturabildiği için kopyalama controller'ı `#messages` altında yeni `.message` düğümlerini izler.

Her message node en fazla bir `.message-copy-actions` alanı alır. Tekrarlı observer çağrıları duplicate düğme üretmez.

## PWA

`message-copy.js` PWA shell cache içindedir. `/api/*` isteklerinin network-only politikası değişmez.

## Değişmeyen Hafize güvenlik sınırları

- Backend tool authorization default-deny kalır.
- Dış yazma/gönderme/merge işlemleri açık onay gerektirir.
- Secret değerleri ajan bağlamına girmez.
- Aktif dört ajanlı selector/specialist roster'ı değişmez.
- `.env`, credential ve `.github/workflows/` bu özellik tarafından değiştirilmez.
