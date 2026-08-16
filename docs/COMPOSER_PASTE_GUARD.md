# Composer yapıştırma sınırı sözleşmesi

`public/composer-paste-guard.js`, 12.000 karakterlik composer sınırını aşan büyük düz metin yapıştırmalarının tarayıcı tarafından sessizce kırpılmasını önler.

## Davranış

- Normal ve sınır içinde kalan yapıştırmalara müdahale edilmez.
- Hesap, mevcut seçim aralığını dikkate alır; seçili metnin üzerine yapıştırma doğru kapasiteyle değerlendirilir.
- Yapıştırma sınırı aşacaksa olay tamamen engellenir ve mevcut taslak/caret içeriği değiştirilmez.
- Kullanıcıya polite status alanında kaç karakter aşıldığı görünür biçimde bildirilir.
- Sonraki normal input durumunda uyarı temizlenir.

## Güvenlik

Metin yalnız kullanıcının gerçek `paste` olayındaki `clipboardData` nesnesinden okunur. Programatik clipboard erişimi, network, storage, form submit veya tool çağrısı yoktur. Controller hiçbir içeriği otomatik göndermez.

## PWA

Asset shell cache v43 kapsamındadır; `/api/*` network-only kalır.

## Geri alma

Controller, loader/PWA kaydı, testler ve bu belge kaldırılırsa tarayıcının varsayılan paste davranışı geri gelir.
