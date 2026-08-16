# Hafize mesaj aksiyonları güvenlik sözleşmesi

## Amaç

Sohbet mesajlarındaki görünür kullanıcı ve Hafize metni üzerinde küçük, açık kullanıcı kontrollü işlemler sunmak Claude-benzeri temel mesaj UX'ini Hafize'ye ekler.

Bu controller üç davranış sağlar:

- `Kopyala`: mesajın görünür metnini panoya yazar.
- `Tekrar gönder`: yalnız kullanıcı mesajını mevcut composer üzerinden yeni bir kullanıcı mesajı olarak tekrar gönderir.
- `Alıntıla`: kullanıcı veya Hafize mesajını composer'a alıntı olarak ekler; otomatik göndermez.

Bunların hiçbiri ajan, model, connector veya backend tool yetkisi değildir.

## Açık kullanıcı niyeti

Her aksiyon yalnız görünür düğmeye kullanıcı tıklamasıyla başlar. Sayfa yüklenmesi, yeni mesaj gelmesi, rerender veya MutationObserver callback'i hiçbir kopyalama, composer değişikliği veya gönderim başlatmaz.

`Tekrar gönder` geçmişteki mesajı sessizce değiştirmez veya silmez. Aynı metni composer'a koyup mevcut `requestSubmit()` yolunu kullanır; sonuç normal bir yeni kullanıcı mesajıdır.

`Alıntıla` hiçbir zaman `requestSubmit()` çağırmaz. Alıntıyı yazara ekler, odağı composer'a taşır ve son gönderme kararını kullanıcıya bırakır.

## Veri sınırları

- Bütün mesaj aksiyonları yalnız `.content.textContent` değerini okur.
- Tool activity etiketleri, trace metadata, DOM attribute'ları veya görünmeyen HTML işlenmez.
- HTML üretilmez ve `innerHTML` kullanılmaz.
- Clipboard için tek mesaj üst sınırı 256 KiB'dir.
- Composer'a taşınan veya yeniden gönderilen metin mevcut textarea sınırıyla aynı şekilde en fazla 12.000 karakterdir.
- Alıntı prefix'leri de 12.000 karakter hesabına dahildir.
- Mevcut gönderilmemiş taslak varken `Alıntıla` taslağı silmez; iki yeni satırla sonuna ekler.
- Taslak + alıntı sınırı aşacaksa işlem fail-closed durur ve mevcut taslak aynen korunur.

## Kopyalama sınırı

- Clipboard yazımı yalnız `navigator.clipboard.writeText` ile ve secure context içinde yapılır.
- Clipboard okunmaz.
- `document.execCommand` veya gizli textarea gibi legacy fallback kullanılmaz.
- Clipboard API yoksa geniş yetkili alternatif yol denenmez.
- Provider/browser hata ayrıntısı kullanıcı mesajına yansıtılmaz.

## Yeniden gönderme sınırı

`Tekrar gönder` ayrı bir `fetch`, API client veya agent execution yolu oluşturmaz. Controller yalnız:

1. exact görünür kullanıcı metnini doğrular,
2. metni `#messageInput` içine taşır,
3. composer `input` yaşam döngüsünü tetikler,
4. canonical `#composer.requestSubmit()` yolunu kullanır.

Aktif yanıt sırasında `#sendBtn.streaming` görülürse yeniden gönderme fail-closed reddedilir. Böylece stop-generation controller ile yarışan ikinci bir run oluşturulmaz.

Normal submit yolu model/ajan seçimini, tool-mode davranışını ve backend default-deny permission enforcement'i aynen kullanır. Message-action controller hiçbir tool approval üretmez.

## Alıntılama sınırı

Alıntı her satırın başına `> ` eklenerek düz metin olarak composer'a taşınır. Markdown render veya HTML parsing bu controller'ın sorumluluğunda değildir.

Alıntılama:

- network isteği yapmaz,
- sohbet geçmişini doğrudan değiştirmez,
- storage yazmaz,
- otomatik submit yapmaz,
- mevcut taslağı sessizce üzerine yazmaz.

## Render yaşam döngüsü

`app.js` mesaj listesini yeniden oluşturabildiği için message-action controller `#messages` altındaki yeni `.message` düğümlerini izler.

Her message node en fazla bir `.message-copy-actions` alanı alır. Tekrarlı observer çağrıları duplicate düğme üretmez. Kullanıcı mesajları `Tekrar gönder + Alıntıla + Kopyala`; Hafize mesajları yalnız `Alıntıla + Kopyala` alır.

## PWA

`message-copy.js` PWA shell cache içindedir. Davranış değişikliğinin kurulu PWA'lara ulaşması için shell cache sürümü v19'a yükseltilmiştir. Eski Hafize shell cache'leri normal service-worker cleanup sözleşmesiyle silinir.

`/api/*` isteklerinin network-only politikası değişmez.

## Değişmeyen Hafize güvenlik sınırları

- Backend tool authorization default-deny kalır.
- Dış yazma/gönderme/merge işlemleri açık onay gerektirir.
- Secret değerleri ajan bağlamına girmez.
- Aktif dört ajanlı selector/specialist roster'ı değişmez.
- Message-action controller `fetch`, `localStorage`, `sessionStorage`, bearer token veya Authorization header kullanmaz.
- `.env`, credential ve `.github/workflows/` bu özellik tarafından değiştirilmez.
