# Schedule Edit Failure Handling

## Auth
`401 AUTH_REQUIRED` kullanıcı oturumunun geçerli olmadığını gösterir. UI güvenli bir oturum mesajı gösterir.

## Ownership
Başkasına ait veya bulunmayan kayıt `404 SCHEDULE_NOT_FOUND` ile maskelenir. Kayıt var/yok ayrımı client'a verilmez.

## State
`running`, `completed`, `failed` ve `cancelled` kayıtlar için `409 SCHEDULE_NOT_EDITABLE` döner.

## Validation
Geçersiz ajan, tarih, task veya deneme değeri `400` ile reddedilir. State mutation yapılmaz.

## Persistence
Storage yazması başarısızsa mutation sonucu state'e uygulanmaz ve mevcut persistence hata sözleşmesi kullanılır.

## Network
İstek kesilirse mevcut görev değişmeden kalır. Panel yenileme sırasında sunucu state'i tekrar okunur.

## Credential
Düz metin credential içeren yeni task text'i update edilmez.

## UX
Hata mesajları status bölgesine yazılır; başarısız update sonrasında kullanıcı form değerlerini değiştirmeye devam edebilir.
