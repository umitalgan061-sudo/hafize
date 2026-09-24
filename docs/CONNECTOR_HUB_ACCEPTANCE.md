# Bağlantılar kabul matrisi

## Workspace

- Connections workspace açılmalı.
- Dört bağlantı kartı doğrudan rail altında bulunmalı.
- Chat ve Tasks kartları Connections seçiliyken gizli kalmalı.
- Connections kapatıldığında önceki card visibility durumu geri yüklenmeli.

## Health

- GitHub configuration boolean gösterilmeli.
- Gmail configuration boolean gösterilmeli.
- Canva configuration boolean gösterilmeli.
- 0/3, 1/3, 2/3 ve 3/3 durumları okunabilir olmalı.

## Gmail

- linked true -> Bağlı.
- linked false -> Bağlı değil.
- GMAIL_NOT_CONFIGURED -> Devre dışı.
- AUTH_REQUIRED -> Oturum gerekli.
- network/timeout -> hata özeti.

## Canva

- linked true -> Bağlı.
- linked false -> Bağlı değil.
- CANVA_NOT_CONFIGURED -> Devre dışı.
- AUTH_REQUIRED -> Oturum gerekli.
- network/timeout -> hata özeti.

## GitHub

- salt-okunur hazır olma durumunu göstermeli.
- write eylemi içermemeli.
- capability listesi görünür olmalı.

## Refresh

- ilk mount'ta çalışmalı.
- ikinci eşzamanlı istek başlamamalı.
- 900 ms cooldown uygulanmalı.
- sekiz saniye timeout uygulanmalı.

## Diagnostics

- tanı özeti credential içermemeli.
- clipboard desteği yoksa exception uygulamayı kırmamalı.

## Accessibility

- aria-labelledby.
- aria-expanded.
- aria-controls.
- visible focus.
- text state.

## Privacy

- provider response persist edilmemeli.
- telemetry olmamalı.
