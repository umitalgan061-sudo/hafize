# Prompt Collection Workspace — Security

## Veri sınırı

Workspace yalnızca yerel koleksiyon ve UI metadata'sı üzerinde çalışır.

Sunucu API'sine koleksiyon endpoint'i eklenmez.

Workspace JavaScript'i network request başlatmaz.

Prompt içeriği metadata anahtarına kopyalanmaz.

## Secret ayrımı

Environment değişkenleri okunmaz.

Cookie içeriği okunmaz.

Bearer token oluşturulmaz veya taşınmaz.

OAuth credential akışı workspace'ten bağımsızdır.

## DOM güvenliği

Kullanıcı kontrollü metin `textContent` ile eklenir.

`innerHTML` kullanılmaz.

`outerHTML` kullanılmaz.

Koleksiyon adı CSS selector olarak ham biçimde kullanılmaz.

Prompt id'leri dataset üzerinden taşınır.

Renk seçimi sabit allowlist içindedir.

## Storage

Storage girişleri JSON olarak parse edilir.

Parse hatası boş/default state'e düşer.

State alanları normalize edilir.

Metadata anahtarları mevcut collection id'leriyle sınırlıdır.

Seçim listesi 40 kayıtla sınırlıdır.

Kullanım sayısı 9999 ile sınırlıdır.

## Import

Import yalnızca kullanıcı tarafından seçilen dosyadan yapılır.

Dosya 500 KB üzerinde ise parse edilmez.

Geçersiz JSON hata durumuyla sonuçlanır.

Import mevcut core dedupe politikasını kullanır.

Metadata isim üzerinden eşleştirilir.

Yedekten gelen id'ler doğrudan mevcut metadata anahtarı olarak güvenilmez.

## Export

Export istem dışarı gönderen bir ağ çağrısı değildir.

Tarayıcı Blob ve Object URL kullanılır.

Object URL işlem sonrası revoke edilir.

Export bounded boyutla sınırlandırılır.

Metadata isim eşleşmesi dosyada görülebilir.

Kullanıcı yedek dosyasının hassas olabileceği konusunda dokümantasyon görür.

## Silme

Tekil silme onay gerektirir.

Bulk silme onay gerektirir.

Koleksiyon silmek prompt kaydını silmez.

Silinen collection metadata'sı prune edilir.

## Arşiv

Archive geri alınabilir bir flag'dir.

Archive işlemi veri silmez.

Active filtresi arşivlenmiş kayıtları saklar.

## Yetki

Koleksiyon değişiklikleri yalnızca yerel uygulama kullanıcısının eylemiyle yapılır.

Dış servis yazma izni istemez.

Workspace kendisini veya başka bir ajanı yetkilendirmez.

## PWA

Service worker shell cache yalnızca aynı-origin asset'leri yönetir.

API yolları network-only kalır.

Workspace asset'leri sabit shell listesinde bulunur.

## Hata yönetimi

Storage yazma başarısızlığı başarı olarak gizlenmez.

Import hatası kaydı otomatik değiştirmez.

Silme iptali state'i korur.

Geçersiz active id normalize edilerek temizlenir.

## İnceleme kontrolü

Yeni workspace kodunda fetch/XHR/WebSocket bulunmamalıdır.

Secret veya cookie erişimi bulunmamalıdır.

Dinamik HTML interpolation kullanılmamalıdır.

Yeni storage anahtarı bounded bir normalize fonksiyonuna sahip olmalıdır.
