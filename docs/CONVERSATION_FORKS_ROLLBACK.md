# Konuşma Dalları Rollback

Fork değişikliğini geri almak için PR revert edilir.

Parent conversation'ın `messages` dizisi fork sırasında değiştirilmediğinden parent verisi korunur. Fork child kayıtları mevcut conversation storage içinde kalabilir; UI geri alındığında normal conversation olarak okunabilir.

Acil temizlik gerekiyorsa yalnız `forkOf` alanı bulunan child conversation kayıtları kullanıcı onayıyla silinebilir.

Service worker eski cache sürümünü temizlerken conversation verisine dokunmaz; cache rollback yalnız asset katmanını etkiler.

Fork notları, başlıkları ve fork metadata'sı conversation normalize katmanında opsiyonel alanlardır.
