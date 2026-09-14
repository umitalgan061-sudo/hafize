# Prompt Library Runbook

## Kurulum kontrolü

1. `public/index.html` içinde `prompt-library.css`, `prompt-library.js` ve `prompt-library-starters.js` bulunmalı.
2. `public/sw-policy.js` aynı üç varlığı shell listesinde bulundurmalı.
3. Cache sürümü değiştiğinde eski `hafize-shell-*` cache'leri temizlenmelidir.

## Normal kullanım

Kullanıcı kartı açtığında mevcut yerel istemler yüklenir. Hiç istem yoksa starter modülü yalnız boş kütüphaneyi on adet başlangıç örneğiyle doldurur.

Starter kayıtları tekrar çalıştırıldığında mevcut kullanıcı kayıtları silinmez ve yeniden eklenmez.

## Depolama sorunu

Kota aşıldığında veya storage erişimi reddedildiğinde durum metni gösterilir. Sohbet geçmişinin storage anahtarı farklıdır; prompt kütüphanesi hatası sohbeti silmemelidir.

## Import sorunu

JSON 1 MB'tan büyükse okunmaz. Geçersiz JSON mevcut kayıtları değiştirmez. Aynı id'ye sahip imported kayıt yeni id ile eklenir.

## Export sorunu

Blob API yoksa export düğmesi sessizce başarısız olur ve kullanıcıya tarayıcı uyumsuzluğu bildirilir.

## UI regresyonu

Kart mobilde utility rail davranışına uyumlu olmalı. Liste uzun olduğunda kart içi scroll kullanılmalıdır; sayfanın ana scroll'u prompt satırları tarafından ele geçirilmemelidir.

## Geri alma

`index.html` içinden prompt library asset referanslarını çıkarın, shell asset listesinden üç girdiyi kaldırın ve cache sürümünü artırın. Kullanıcının mevcut `hafize.prompt-library.v1` verisi ayrıca silinmek zorunda değildir.

## Incident kaydı

Bir güvenlik veya veri kaybı bulgusunun ilk kontrolü: dış HTTP çağrısı olmadığını, `innerHTML` kullanımının eklenmediğini ve import id çakışmasının overwrite yapmadığını doğrulayın.
