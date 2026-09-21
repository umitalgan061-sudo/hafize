# Composer Ekleri — Test Cases

TC01 txt file kabul edilir.
TC02 unknown extension reddedilir.
TC03 zero byte reddedilir.
TC04 256 KB üstü read edilmez.
TC05 duplicate queue'ye eklenmez.
TC06 4 file sınırı uygulanır.
TC07 200K queue sınırı uygulanır.
TC08 binary control yoğunluğu reddedilir.
TC09 range 400 satırla sınırlandırılır.
TC10 preview 12 satırla sınırlıdır.
TC11 fenced content collision güvenli fence üretir.
TC12 cursor insertion mevcut selection'i korur.
TC13 atomic capacity failure textarea'yı değiştirmez.
TC14 undo önceki textarea state'ini güvenli biçimde geri getirir.
TC15 copy yalnız range text'i clipboard'a yazar.
TC16 quick action yalnız selected attachment kullanır.
TC17 risky content confirm olmadan insert edilmez.
TC18 expiry staged memory'yi temizler.
TC19 destroy listener/timer temizler.
TC20 PWA static attachment assetlerini shell'e dahil eder.
TC21 normal text paste attachment handler tarafından bozulmaz.
TC22 attachment seçimi network request üretmez.
TC23 attachment insert otomatik submit üretmez.