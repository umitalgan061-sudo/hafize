# Composer Ekleri — Browser Fallbacks

## File.text yok
Policy FileReader fallback'i kullanır.

## Clipboard file yok
Paste handler clipboardData.files boşsa normal text paste davranışına dokunmaz.

## Drag-drop yok
Dosya seç düğmesi her zaman kullanılabilir.

## Keyboard yok
Temel touch/button akışı kısayollar olmadan çalışır.

## Clipboard permission denied
Kopyalama status mesajıyla başarısız olur; composer ve queue değişmez.

## Confirmation yok
Riskli attachment kullanıcı onaylamazsa insert yapılmaz.

## Native number input
Range alanlarının clamp'i browser validasyonu dışında policy katmanında da uygulanır.

## Browser farklılığı
Bu fallback'ler progressive enhancement yaklaşımıdır; temel kabul dosya picker ile korunur.