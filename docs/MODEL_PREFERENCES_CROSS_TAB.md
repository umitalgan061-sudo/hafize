# Model ve Ajan Tercihleri Cross-Tab

## Amaç

Aynı tarayıcı origin'inde açık iki Hafize sekmesinde tercih panelinin stale görünmesini azaltmak.

## Event

localStorage storage eventi dinlenir.
Yalnız hafize.model-preferences.v1 anahtarı dikkate alınır.
Diğer storage değişiklikleri ignore edilir.

## Davranış

Başka sekmede profil değişirse açık panel güncellenir.
Panel kapalıysa yalnız state yeniden okunur.
Chat mesajları veya conversation storage etkilenmez.

## Yaşam döngüsü

Listener mount sırasında bağlanır.
Controller destroy edildiğinde kaldırılır.
Bu sayede uygulama kapanıp açıldığında duplicate listener oluşmaz.

## Sınır

Cross-tab sync aktif sohbet modelini otomatik zorla değiştirmez.
Kullanıcı açık paneli görerek güncel tercihi inceleyebilir.
