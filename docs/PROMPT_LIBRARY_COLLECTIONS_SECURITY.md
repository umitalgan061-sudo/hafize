# Koleksiyon Güvenlik Notları

## Tehdit alanı

Koleksiyon isimleri ve prompt ID'leri kullanıcı kontrollü localStorage verisinden gelebilir. Bu veriler güvenilmez giriş kabul edilir.

## DOM güvenliği

Koleksiyon isimleri `textContent` kullanılarak yazılır. Select option metinleri de textContent ile doldurulur.

Dinamik HTML template'leri veya `innerHTML` tabanlı koleksiyon kartları kullanılmaz.

## Storage güvenliği

JSON parse hataları fallback ile karşılanır. localStorage yazma hatası kullanıcıya bounded status mesajı ile bildirilir.

Storage anahtarları sabittir. Kullanıcı verisi üzerinden anahtar adı üretilmez.

## Import sınırı

Dosya boyutu istemci tarafında parse edilmeden önce kontrol edilir. 500 KB üzerindeki koleksiyon yedekleri işlenmez.

Import edilen nesneler normalize edilir ve koleksiyon sayısı 24 ile sınırlandırılır.

## URL davranışı

Export sırasında oluşturulan object URL kısa ömürlüdür. İndirme tamamlandıktan sonra URL revoke edilir.

Dış kaynağa istek atan hiçbir koleksiyon akışı yoktur.

## Yetki

Koleksiyonlar yerel kişisel çalışma alanının parçasıdır. Dış servis yazma yetkisi istemez.

## Gizlilik

Koleksiyon adı, prompt kimliği ve atama ilişkileri analytics API'sine gönderilmez.

## Kurtarma

Bozuk bir assignment map prompt içeriğini bozmaz. Sadece eşleşmeyen ilişki temizlenir.

Koleksiyon silme prompt silme operasyonu değildir ve onay metni açıkça bunu belirtir.

## Test beklentisi

Kaynak testleri yeni modülün fetch/XHR/WebSocket kullanmadığını, güvenli DOM API'leri kullandığını ve bounded parse davranışını doğrulamalıdır.
