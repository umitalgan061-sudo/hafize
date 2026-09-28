# Görev Merkezi Güvenlik Özeti

Schedule center browser enhancements yeni bir yetki katmanı açmaz.

Preview, duplicate, template, planning, detail, insights ve export modülleri ayrı ayrı kendi network çağrılarını oluşturmaz. Gerçek POST yalnız typed schedule workspace tarafından yapılır.

LocalStorage kullanılan modüller taslak ve template gibi açık kullanıcı tercihiyle kaydedilen local verilerle sınırlıdır. Preview activity yalnız memory'de tutulur.

Task metadata içinde credential, token veya Authorization header verisi kullanılmaz. Dinamik task metni textContent/value sınırında işlenir.

Backend authentication, ownership, CSRF, schedule validation ve state transition mantığı olduğu gibi korunur.
