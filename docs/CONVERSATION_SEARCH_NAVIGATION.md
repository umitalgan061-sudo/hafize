# Conversation search navigation contract

Hafize, aktif sohbet araması içinde görünen eşleşmeler arasında güvenli biçimde odak taşıyabilir.

## Davranış

- Gezinme yalnız arama sorgusu boş değilken etkinleşir.
- Yalnız `.conversation-row` içinde görünür kalan `.conversation-open` hedefleri kullanılabilir.
- `Önceki` ve `Sonraki` 44 px minimum hedeflerdir.
- `Alt+↑` ve `Alt+↓` aynı gezinmeyi klavyeden yapar.
- Normal ok tuşları arama input'unun metin düzenleme davranışını korur.
- Gezinme döngüseldir ve yalnız odağı taşır; sohbeti otomatik açmaz.

## Güvenlik

- Yeni network isteği, provider/connector çağrısı veya backend endpoint yoktur.
- Storage, cookie, token, credential veya clipboard okunmaz/yazılmaz.
- Gezinme hiçbir butona programatik click uygulamaz; mesaj, tool veya dış yan etki başlatmaz.
- Agent roster ve backend default-deny / explicit external-write approval sözleşmeleri değişmez.

## Lifecycle

Query veya görünür sonuç seti değiştiğinde aktif indeks sıfırlanır. Controller destroy sırasında event listener, observer ve ek UI düğümlerini temizler. PWA asset'i shell içinde cache'lenir; `/api/*` network-only kalır.
