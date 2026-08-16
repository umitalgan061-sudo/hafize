# Ağ durumu göstergesi

## Amaç

Hafize web/PWA arayüzünde cihaz tarayıcısının bildirdiği çevrimdışı durumu görünür hale getirmek. Bu katman bağlantıyı kendi başına test etmez ve hiçbir isteği yeniden göndermeye çalışmaz.

## Davranış

- `navigator.onLine === false` olduğunda üst barda `Çevrimdışı · yanıt gönderilemez` durumu görünür.
- Tarayıcı `online` olayı verdiğinde `Bağlantı geri geldi` mesajı kısa süre görünür ve sonra gizlenir.
- Başlangıçta cihaz çevrimiçiyse ek UI gösterilmez.
- Gösterge `role=status`, `aria-live=polite` ve `aria-atomic=true` kullanır.
- Controller kaldırıldığında event listener ve bekleyen timer temizlenir.

## Bilinçli sınır

Tarayıcıdaki `navigator.onLine` yalnız ağ erişilebilirliği sinyalidir; NVIDIA, GitHub veya başka bir servisin gerçekten erişilebilir olduğunu garanti etmez. Bu nedenle gösterge backend health-check sonucu gibi sunulmaz.

## Güvenlik ve veri sınırı

`network-status.js`:

- `fetch`, WebSocket veya başka network çağrısı yapmaz;
- mesaj/sohbet içeriğini okumaz;
- localStorage/sessionStorage/cookie/clipboard kullanmaz;
- otomatik submit, retry, tool çağrısı veya dış yazma/gönderme üretmez;
- yalnız `online` / `offline` browser event'leri ve kendi status DOM düğümüyle çalışır.

Backend default-deny tool permission, approval gates, trace/task-ledger, secret isolation ve dört profilli ajan roster'ı değişmez.

## PWA

`/network-status.js` statik shell asset'idir. `/api/*` istekleri network-only kalır.

## Geri alma

Controller, loader/PWA wiring, test ve bu belge kaldırılabilir; sohbet ve backend davranışları etkilenmez.
