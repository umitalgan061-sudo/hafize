# Organizer — Test Matrisi

| Alan | Senaryo | Beklenen |
|---|---|---|
| Bootstrap | Panel henüz yok | No-op, exception yok |
| Bootstrap | Panel sonradan oluşur | Organizer attach olur |
| Search | Boş arama | Tüm uyumlu satırlar görünür |
| Search | Task metni eşleşir | Satır görünür |
| Search | Büyük/küçük harf | Locale duyarlı eşleşme çalışır |
| Search | 120+ karakter | Input sınırı uygulanır |
| Agent | Tüm ajanlar | Agent filtresi kaldırılır |
| Agent | Tek ajan | Yalnızca ajan eşleşmeleri kalır |
| Sort | Yaklaşan | Küçük timestamp önce |
| Sort | Uzaklaşan | Büyük timestamp önce |
| Sort | Durum | Tanımlı status sırası korunur |
| Sort | Görev adı | Türkçe locale sıralaması kullanılır |
| Time | Bugün | Gün başlangıcı/bitişi aralığı kullanılır |
| Time | 24 saat | Şimdi + 24 saat aralığı kullanılır |
| Time | 7 gün | Şimdi + 7 gün aralığı kullanılır |
| Time | Geçmiş | Şimdiden eski kayıtlar görünür |
| Preset | Yeni görünüm | En fazla altı görünüm tutulur |
| Preset | Aynı isim | Mevcut görünüm güncellenir |
| Preset | Sil | Yalnızca preset kaldırılır |
| Preset | Bozuk JSON | Varsayılan boş liste |
| Selection | Scheduled row | Checkbox etkin |
| Selection | Running row | Checkbox disabled |
| Bulk cancel | Onay yok | DELETE başlamaz |
| Bulk cancel | Onay var | Sıralı DELETE çağrıları yapılır |
| Bulk cancel | 40+ kayıt | 40 kayıtla sınırlanır |
| Export | Görünür kayıt | Fresh GET snapshot kullanılır |
| Export | Zaman filtresi | Dashboard tarafından gizlenen kayıt export edilmez |
| Export | 1 MB+ | Export iptal edilir |
| Copy | Clipboard mevcut | Task text panoya yazılır |
| Copy | Clipboard yok | Hata bildirimi, network yok |
| Detail | Aç | Dialog görünür |
| Detail | Escape | Dialog kapanır |
| Detail | JSON copy | Yalnızca kullanıcı etkileşimi |
| Duplicate | Confirm false | POST başlamaz |
| Duplicate | Confirm true | Yeni future schedule POST edilir |
| Duplicate | maxAttempts | 1–5 aralığı korunur |
| Security | XSS task text | `textContent`, HTML yok |
| Security | ID path | `encodeURIComponent` kullanılır |
| Security | Credential | Token local storage'a yazılmaz |
| PWA | Asset listesi | Organizer asset'leri shell'e eklenir |
| PWA | API cache | `/api/` network-only kalır |
| Lifecycle | Unload | MutationObserver durur |
| Lifecycle | Duplicate boot | İkinci toolbar eklenmez |

## Test katmanları

Kaynak sözleşme testleri hızlı PR doğrulaması sağlar.

UI smoke testleri DOM semantiğini kontrol eder.

PWA testleri shell/cache sınırını kontrol eder.

Güvenlik testleri dynamic text ve state-changing boundary'yi kontrol eder.

## Exit criteria

Tüm kritik satırlar `ok` olmalıdır.

3000 changed-line bütçesi aşılmamalıdır.

Yeni endpoint eklenmemelidir.
