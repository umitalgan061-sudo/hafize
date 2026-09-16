# Sohbet Markdown Render — Güvenlik Sınırı

Model çıktısı, kullanıcı metni ve araç sonuçları güvenilmeyen metin olarak kabul edilir.

## DOM güvenliği

Renderer HTML string üretmez. Ağaç `createElement`, `createTextNode` ve `textContent` ile oluşturulur. `innerHTML`, `insertAdjacentHTML`, `eval` ve `new Function` kullanılmaz.

## Bağlantı güvenliği

Yalnız `http:`, `https:` ve `mailto:` şemaları bağlantı olarak etkinleştirilir. `javascript:`, `data:`, göreli ve kontrol karakteri içeren hedefler düz metin kalır. Dış bağlantılarda `noopener noreferrer nofollow ugc` uygulanır.

## Kaynak ve sınırlar

Kaynak Markdown conversation storage'da olduğu gibi kalır. Renderer yalnız sunum katmanıdır ve backend'e çağrı yapmaz. Ayrıştırma; giriş uzunluğu, satır uzunluğu, nesting ve liste boyutu ile bounded tutulur. Sınır aşıldığında kullanıcı metni kaybolmaz; güvenli düz metin fallback'i gösterilir.

## Streaming

Delta'lar tek animation frame içinde birleştirilir. Nihai render bekleyen frame'i geçersiz kılar. Böylece geç gelen bir delta tamamlanmış yanıtın üzerine yazamaz.

## Gizlilik

Markdown parser herhangi bir analytics, telemetry, remote image, fetch veya WebSocket çağrısı yapmaz. Bağlantılar tıklanana kadar ağ isteği başlatılmaz; kullanıcı seçimi dışında dış etkileşim yoktur.

## Geri alma

Loader kaldırıldığında `app.js` mevcut text-only fallback'ine döner. Conversation history, credentials ve server-side izinler etkilenmez.
