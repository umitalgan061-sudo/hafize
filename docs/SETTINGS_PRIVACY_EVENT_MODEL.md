# Event Modeli

Privacy center iki tür dış değişikliği dinler:

1. native storage event;
2. hafif uygulama içi `hafize:privacy-data-changed` olayı.

Storage event key null ise veya tanımlı bir surface'a aitse inventory yenilenir.

Temizleme işlemi tamamlandıktan sonra event detail içine yalnız action, surface id ve removed sayısı yazılır.

Prompt/message içeriği event detail'e konmaz.

Asenkron storage estimate sonucu panel destroy edildiyse render işlemi yapılmaz.

Event listener'ların yaşam döngüsü mount/destroy ile sınırlıdır.
