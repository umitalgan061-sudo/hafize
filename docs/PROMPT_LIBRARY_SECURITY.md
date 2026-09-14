# Prompt Library Güvenlik Sözleşmesi

## Yerel sınır

Kütüphane yalnız tarayıcıdaki `localStorage` alanına erişir. Yeni backend endpoint'i, OAuth kapsamı veya connector yetkisi yoktur.

## HTML güvenliği

Kullanıcı istemleri güvenilmeyen metindir. Kart başlıkları, gövdeleri, etiketleri ve durum mesajları DOM düğümlerine `textContent` ile yazılır.

İstem gövdesi hiçbir zaman `innerHTML` ile render edilmez. Kayıtların içinde HTML bulunması metin olarak kalır.

## Dosya içe aktarma

İçe aktarılan dosya yalnız JSON kabul eder ve 1 MB ile sınırlandırılır. JSON parse başarısızsa kayıtlar değiştirilmez.

Import sırasında kayıt sayısı 120 ile sınırlanır. Mevcut id üzerine yazılmaz; çakışan import kaydına yeni id üretilir.

## Değişkenler

Değişken isimleri yalnız harf, rakam, alt çizgi ve tire ile kabul edilir. Değerler istem kullanımı sırasında en fazla 1.000 karakter olarak yerleştirilir.

Değişken değeri DOM'a doğrudan değil, textarea'nın düz metin değerine yazılır. Böylece kullanıcı girdisi HTML olarak yorumlanmaz.

## Dışa aktarma

Export yalnız yerel Blob oluşturur. İçerik üçüncü taraf servise gönderilmez.

Dosya adı sabit bir isimdir; kullanıcı girdisi dosya adına dönüştürülmez.

## Tehlikeli içerik

`javascript:`, `data:` veya benzeri URL değerlendirmesi yoktur çünkü prompt içeriği bağlantı nesnesi olarak işlenmez.

## Yetki

Kütüphane chat gönderme, conversation silme veya connector işlemi yapmaz. Kullanıcı `Kullan` dediğinde yalnız composer textarea değeri değiştirilir.

## Depolama hatası

Private browsing, kota veya storage erişim hatasında uygulama bozulmamalıdır. UI durum mesajı üretir; mevcut sohbet geçmişi bu hatadan etkilenmez.
