# Konuşma Dalları Gözlemlenebilirlik

Fork özelliği telemetry eklemez.

UI durumları kullanıcıya toast ve görünür branch listesiyle aktarılır. Teknik tanı için HafizeConversationForks globali sabit API sözleşmesini expose eder.

Önerilen manuel kontroller:
1. Local storage conversation kaydını doğrula.
2. Aktif messages elementinin data-conversation-id değerini kontrol et.
3. aria-busy değerini kontrol et.
4. Branch panel child count değerini kontrol et.
5. Parent ve fork id alanlarının eşleştiğini kontrol et.

Tarayıcı konsolundan üretim endpoint'i çağırmak gerekmez.
