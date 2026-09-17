# Organizer — Validation Scope

Bu turdaki doğrulama iki katmandadır.

Birinci katman kaynak sözleşme testleridir: asset wiring, storage bounds, duplicate boundary, bulk actions, dashboard, time filters, DOM safety, lifecycle, security ve PWA.

İkinci katman manuel kod incelemesidir: backend endpoint değişikliği olmadığının, kullanıcı onayı gerektiren işlemlerin doğrudan kullanıcı etkileşimiyle başladığının ve localStorage'ın yalnızca görünüm state'i tuttuğunun kontrol edilmesi.

Yerel test çalıştırması ortam DNS çözümleme kısıtı nedeniyle gerçekleştirilemedi.

GitHub Actions workflow'u bu commit için mevcut değilse bu durum sonuç olarak açıkça kabul edilmelidir.

Bu dosya yalnızca release provenance içindir; uygulama runtime'ına dahil edilmez.
