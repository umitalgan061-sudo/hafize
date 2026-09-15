# Prompt Workspace — Kullanıcı Rehberi

## Çalışma alanı nedir?

Çalışma alanı, aynı Prompt Library kayıtları üzerinde farklı çalışma düzenlerini saklamanı sağlar. Örneğin `Kod`, `Araştırma` ve `Günlük` adında üç alan oluşturup her birinde farklı arama ve seçim durumunu koruyabilirsin.

## Workspace oluşturma

Prompt Library'de çalışma alanı araç çubuğundan yeni alan oluşturulur. Bir ad yazıp kaydettiğinde alan mevcut filtre durumunu başlangıç noktası olarak alır.

Aynı isim ikinci kez oluşturulamaz. `Genel` alanı sistem başlangıç alanıdır ve silinemez.

## Alan değiştirme

Seçim kutusundan başka bir workspace seçildiğinde önce mevcut çalışma durumu saklanır. Yeni alanın state değeri Prompt Library'ye uygulanır.

State; arama metni, aktif etiket, favori filtresi ve sıralama bilgisini içerir.

## Koleksiyonlar

Koleksiyon, prompt kayıtlarını konu veya amaca göre ayırır. `Genel` varsayılan koleksiyondur. Tek bir prompt satırındaki seçimden veya koleksiyon yönetim panelinden yeni koleksiyonlar oluşturulabilir.

Bir koleksiyon silindiğinde ona atanmış prompt'lar `Genel` kapsamına döner. Bu işlem prompt gövdesini silmez.

## Revizyon geçmişi

Bir prompt yeniden kaydedildiğinde önceki içerik revizyon olarak tutulabilir. Prompt satırındaki `Geçmiş` kontrolü ile geçmiş sürümler açılır.

Bir revizyonu geri yüklemek mevcut içeriğin üstüne körlemesine yazmak yerine önce snapshot almaya çalışır. Restore edilen sürüm yeni bir içerik olarak kaydedilir.

## Smart Insert

`Ekle` eylemi seçili prompt metnini composer alanına hazırlar. Mevcut metni koruyarak sona ekleme modu programatik olarak desteklenir.

Her iki akışta da mesaj otomatik gönderilmez.

## Workflow

Seçili prompt'lardan workflow oluşturulabilir. Workflow adımları sırasıyla derlenir. `replace` bir sonraki ana çıktıyı değiştirir; `append` önceki metnin sonuna eklenir.

Değişkenler workflow derleme anında çözülür. Çözülmüş değerler workflow storage içine yazılmaz.

## Prompt Pack

Paket dışa aktarma; prompt'ları, state'i, koleksiyonları, workspace profillerini ve revizyonları tek JSON altında saklayabilir. Dosya açık kullanıcı eylemiyle oluşturulur.

Paket içe aktarmadan önce review ekranında boyut ve içerik özeti görülebilir. Mevcut prompt ID'leri üzerine yazılmaz.

## Toplu düzenleme

En fazla 40 prompt aynı anda seçilebilir. Toplu düzenleme etiket ve favori durumunu bir işlemde değiştirebilir; koleksiyon ataması ayrı katmandan yapılır.

## Kütüphane sağlığı

Sağlık paneli tekrar eden prompt ID, sahipsiz revision, geçersiz collection assignment ve workspace içindeki artık prompt referanslarını kontrol eder.

## Gizlilik

Workspace verisi cihazda tutulur. Yeni server analytics veya prompt telemetry yoktur. Export dosyası indirildikten sonra dışarıya gönderilmesi uygulamanın kontrolünde değildir.

## Veri temizleme

Bir prompt'u silmek temel kaydı kaldırır. Geçmiş revizyonlar otomatik silinmeyebilir; hassas içerik için revizyon storage'ı ayrıca temizlenmelidir.
