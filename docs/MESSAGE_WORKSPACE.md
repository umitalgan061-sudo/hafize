# Mesaj Çalışma Alanı

## Amaç

Mesaj Çalışma Alanı, Hafize sohbetindeki tek tek mesajları yerel olarak işaretlemek ve daha sonra yeniden bulmak için kullanılan istemci tarafı bir çalışma alanıdır.

Temel kullanım senaryosu, uzun bir sohbet içinden önemli bir kullanıcı mesajını veya Hafize yanıtını kaybetmeden saklamaktır.

Bu katman mevcut sohbet geçmişinin yerine geçmez.

Sohbet metni `hafize.conversations.v1` anahtarında kalır.

Mesaj çalışma alanı metadata'sı `hafize.message-workspace.v1` anahtarında tutulur.

Bu ayrım, sohbet yeniden kaydedildiğinde metadata'nın yanlışlıkla silinmesini önler.

## Mesaj eylemleri

Her mesajın altında kaydetme düğmesi bulunur.

Kaydedilmiş bir mesaj yıldız ile gösterilir.

Kullanıcı ve asistan mesajlarının ikisi de kaydedilebilir.

Asistan mesajlarında olumlu ve olumsuz geri bildirim düğmeleri bulunur.

Aynı geri bildirim düğmesine ikinci kez basılması geri bildirimi kaldırır.

Bir mesaja kısa bir not eklenebilir.

Not en fazla 600 karakterdir.

Bir mesaja en fazla 8 etiket bağlanabilir.

Etiketlerin her biri en fazla 24 karakterdir.

Aynı etiket aynı mesajda birden fazla kez tutulmaz.

Boş bir not, boş geri bildirim, boş etiket listesi ve kaydedilmemiş durum birlikte olduğunda kayıt temizlenir.

## Panel

Sağ yardımcı araç rail'ine Mesaj Çalışma Alanı paneli eklenir.

Panel yalnız mevcut sohbette metadata kaydı bulunan mesajları listeler.

Arama, mesaj metni, not ve etiket üzerinde yapılır.

Arama en fazla 120 karakterdir.

Filtreler tümü, kaydedilen, geri bildirimli, notlu, kullanıcı mesajları, Hafize yanıtları ve etiketli görünümü içerir.

Sıralamalar güncellenen, eski, etkileşimli ve notlular biçimindedir.

Kayıtlı sonuçlar seçilebilir.

Seçim en fazla 100 kayıttır.

Görünen kayıtların tamamı tek işlemle seçilebilir.

Seçim temizlenebilir.

Seçilen kayıtlar JSON olarak dışa aktarılabilir.

JSON çıktısı istemci tarafında Blob üzerinden oluşturulur.

Ağ isteği oluşturulmaz.

## Kısayollar

`Ctrl/⌘ + Shift + B` Mesaj çalışma alanı aramasına gider.

`Ctrl/⌘ + Shift + K` görünen mesaj kayıtlarını seçer.

`Ctrl/⌘ + Shift + X` mesaj seçimini temizler.

Kısayollar form alanlarının standart yazımını engellemez; yalnız modifier kombinasyonu tam eşleştiğinde çalışır.

## Veri yaşam döngüsü

Metadata kayıtları konuşma id'si ve mesaj id'si ile bağlanır.

Bir konuşma yeniden çizildiğinde DOM eklentisi MutationObserver ile yeniden uygulanır.

Bir mesaj DOM'dan kaybolduğunda periyodik cleanup, o konuşmaya ait eski metadata'yı kaldırır.

Başka sekmede kayıt değişirse `storage` olayı yeniden yükleme tetikler.

Aynı sekmede değişiklik olursa `hafize:message-workspace-changed` olayı gönderilir.

## Sınırlar

Kayıt sayısı 240 ile sınırlıdır.

Dışa aktarma 100 kayıtla sınırlıdır.

Sohbet mesaj içeriği kayıt ekranında 12.000 karakterle sınırlandırılmıştır.

UI notu 600 karakterle sınırlıdır.

Etiket sayısı 8 ile sınırlıdır.

Etiket uzunluğu 24 karakterle sınırlandırılmıştır.

Geçersiz feedback değerleri boş değere dönüştürülür.

Geçersiz filtre ve sıralama değerleri varsayılana döner.

Prototype üzerinden gelen değerler güvenilir veri olarak kabul edilmez.

## Güvenlik

Bu özellik yalnız `localStorage` kullanır.

Kullanıcı kimlik bilgileri, token, cookie, Authorization başlığı veya API anahtarı depolanmaz.

Modül `/api/` endpoint'i çağırmaz.

`fetch`, `XMLHttpRequest` ve `WebSocket` kullanılmaz.

HTML string üretimi yapılmaz.

Kullanıcı içeriği `textContent` ile düğüme yazılır.

Not ve etiketler HTML olarak yorumlanmaz.

JSON dışa aktarma yerel Blob'dur.

Harici servise yazma veya silme yüzeyi yoktur.

## Uyumluluk

Mevcut sohbet kayıt şeması değiştirilmez.

Mesaj metadata'sı bağımsız anahtarda olduğundan eski sohbet kayıtları çalışmaya devam eder.

Metadata anahtarı silinse bile sohbet geçmişi etkilenmez.

Metadata bozulursa yalnız Mesaj Çalışma Alanı boş görünür.

Service worker shell listesi yeni JS ve CSS dosyalarını içerir.

## Test kapsamı

Policy testi sınırları ve normalize işlemlerini doğrular.

Source testi shell entegrasyonu ve ağ/credential yokluğunu doğrular.

Adversarial test prototype pollution benzeri kalıpları ve aşırı seçimleri sınar.

Compatibility testi eski/kısmi kayıtları ve quota sınırlarını doğrular.

Tam check gate, bu testlerin yanında depo genelindeki mevcut test paketlerini çalıştırır.
