# Prompt Smart Fill — Tur Kaydı

## Kapsam

Bu turdaki ana iyileştirme, değişken içeren Prompt Library istemlerinin doğrudan tarayıcı `prompt()` akışına bırakılmaması ve erişilebilir bir doldurma deneyimi sunulmasıdır.

Kullanıcı istemi seçtiğinde değişken alanları açılır, canlı önizleme gösterilir, değerler yalnızca yerel kullanım bağlamında tutulur ve sonuç mevcut `#messageInput` composer alanına aktarılır. Otomatik gönderim yapılmaz.

## Tamamlanan parçalar

- değişken keşfi ve sınırlandırılmış alan üretimi,
- canlı güvenli önizleme,
- klavye ile alanlar arasında gezinme,
- Escape ile kapatma ve odak geri verme,
- Tab odak döngüsü,
- önizlemeyi panoya kopyalama,
- istem başına yerel değişken seti/preset desteği,
- storage hatalarına karşı güvenli geri dönüş,
- mevcut `useCount` davranışı ile uyumluluk,
- command palette ve smart-fill hints entegrasyonu,
- PWA shell cache entegrasyonu,
- veri/DOM/güvenlik/lifecycle regresyon testleri,
- kullanıcı, operasyon ve release dokümantasyonu.

## Gizlilik sınırı

Smart Fill değeri backend'e, analytics'e veya remote telemetry'ye göndermez. Değişken setleri ayrı bir localStorage anahtar alanında tutulur ve prompt gövdesine backend tarafında birleştirme yapılmaz.

## Tur bütçesi

Başlangıç base commit: `998547ddc63e8b3a62ad74c3ed49614df62620d4`.

Base → head GitHub compare sonucu: **2.967 changed lines**. Bu değer additions + deletions toplamıdır ve 3000 satırlık üst sınırın altındadır.

Kalan fark yalnızca 33 satırdır; kota doldurmak için davranışsız değişiklik yapılmayacaktır.

## Geri alma

PR revert edildiğinde mevcut Prompt Library çekirdeği korunur; smart-fill/command-palette enhancement dosyaları ve ilgili PWA asset kayıtları geri alınır. Local prompt kayıtlarının silinmesi zorunlu değildir.
