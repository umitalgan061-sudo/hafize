# Release Checklist

### Kod

- Privacy module syntax geçiyor.
- Allowlist tüm aktif yerel yüzeyleri içeriyor.
- Unknown key preservation korunuyor.
- Destructive clear için onaylar mevcut.
- Clipboard işlemi explicit action ile sınırlı.

### UI

- Settings Workspace içinde görünüyor.
- Mobile düzen bozulmuyor.
- Focus/ARIA ilişkileri korunuyor.
- Search ve copy actions çalışıyor.

### PWA

- CSS index'e ekli.
- JS index'e ekli.
- sw-policy shell listesinde.
- Cache versiyonu yükseltilmiş.

### Güvenlik

- fetch/XHR/WebSocket yok.
- raw storage value report'a girmiyor.
- global localStorage.clear yok.

### Geri alma

Kod revert edildiğinde kullanıcı storage'ı otomatik silinmiyor.
