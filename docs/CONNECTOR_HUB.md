# Bağlantılar çalışma alanı

## Amaç

Bağlantılar çalışma alanı, Hafize içindeki kullanıcı izinli connector'ların güvenli durumunu tek bir yüzeyde gösterir.

## Kapsam

- GitHub salt-okunur çalışma alanı hazır olma durumu
- Google / Gmail salt-okunur bağlantı durumu
- Canva salt-okunur bağlantı durumu
- toplu sağlık özeti
- manuel durum yenileme
- son yenileme zamanı
- geçici gizleme/gösterme
- oturum ve network hatalarının güvenli gösterimi

## Kapsam dışı

- access token gösterme
- refresh token gösterme
- OAuth secret gösterme
- branch oluşturma
- commit yazma
- PR merge etme
- Gmail gönderme
- Canva içerik yazma
- connector yetkisini yükseltme

## Veri kaynağı

Toplu durum /api/health üzerinden okunur. Gmail ve Canva bağlantı sahipliği ayrıca mevcut status endpoint'lerinden okunur.

## Tarayıcı davranışı

Tüm sorgular same-origin ve GET'tir. İsteklere JSON kabul başlığı eklenir. Uzun süren istekler AbortController ile sonlandırılır.

## Durum sözlüğü

- Hazır: sunucu connector kapasitesi kullanılabilir.
- Bağlı: ilgili kullanıcı için bağlantı kaydı vardır.
- Bağlı değil: connector yapılandırılmış olsa da kullanıcı bağlantısı yoktur.
- Devre dışı: connector runtime yapılandırılmamıştır.
- Oturum gerekli: protected status endpoint'i kullanıcı oturumu bekliyor.
- Bekleniyor: ilk sağlık sorgusu henüz tamamlanmadı.
- Hata: sunucu veya network sonucu okunamadı.

## Kullanıcı akışı

1. Kullanıcı Bağlantılar çalışma alanını açar.
2. Kartlar görünür.
3. Panel ilk sağlık sorgusunu otomatik başlatır.
4. Kullanıcı durumları provider bazında görür.
5. Yenileme düğmesi yeni bir sorgu başlatır.
6. Sonuçlar mevcut backend izin sınırlarını değiştirmez.

## State

Gizle/göster tercihi yalnızca sessionStorage içinde tutulur. Connector yanıtları kalıcı browser storage'a yazılmaz.

## Başarı ölçütleri

- sayfa yüklenince kartlar oluşur
- bağlantılar çalışma alanında doğru kartlar görünür
- refresh yalnız GET çalıştırır
- timeout kullanıcıya güvenli metin verir
- token veya secret DOM'a yazılmaz
- destroy tüm listener ve kartları temizler

## Geri alma

connector-hub.js, connector-hub.css, index/service-worker bağlantıları ve workspace-navigation kart ID'si birlikte geri alınabilir.

## Tasarım ilkesi

Bağlantılar merkezi “ayarları yeniden yazan” ikinci bir policy katmanı değildir. Mevcut server-side authentication, OAuth policy ve connector ownership katmanlarının yalnızca görünür durumunu sunar.
