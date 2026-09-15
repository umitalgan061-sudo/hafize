# Revision History Release Checklist

## Kod

- [ ] Revision module yalnız revision storage key'ini kullanıyor.
- [ ] Prompt Library core API'ye yeni zorunlu dependency eklenmedi.
- [ ] Restore mevcut prompt id'sini koruyor.
- [ ] Restore favorite değerini koruyor.
- [ ] Restore useCount değerini koruyor.
- [ ] Restore createdAt değerini koruyor.
- [ ] Restore updatedAt değerini güncelliyor.

## Storage

- [ ] Bozuk JSON exception üretmiyor.
- [ ] Boş prompt body revision olarak kabul edilmiyor.
- [ ] 10 revision retention çalışıyor.
- [ ] 120 prompt sınırı çalışıyor.
- [ ] Duplicate snapshot engelleniyor.

## UI

- [ ] Geçmiş düğmesi her prompt kartında bir kez görünüyor.
- [ ] Panel açıldığında aktif revision listesi yükleniyor.
- [ ] Kapat düğmesi çalışıyor.
- [ ] Escape çalışıyor.
- [ ] Tab focus trap çalışıyor.
- [ ] Status mesajları erişilebilir.
- [ ] Preview overflow ile taşmıyor.

## Security

- [ ] innerHTML kullanılmıyor.
- [ ] Kullanıcı metni HTML olarak yürütülmüyor.
- [ ] Revision export upload yapmıyor.
- [ ] Revision module ağ çağrısı yapmıyor.
- [ ] Kullanıcı onayı olmadan restore/silme gerçekleşmiyor.

## PWA

- [ ] Revision asset shell cache'te.
- [ ] Cache version artırılmış.
- [ ] API request classification değişmedi.

## QA

- [ ] Core contract testi geçti.
- [ ] Bounds testi geçti.
- [ ] Normalization testi geçti.
- [ ] Retention testi geçti.
- [ ] Restore testi geçti.
- [ ] Storage testi geçti.
- [ ] Export testi geçti.
- [ ] DOM testi geçti.

## Rollout

Özellik önce küçük kullanıcı grubunda doğrulanabilir. Sorun görülürse revision UI geri alınır; local storage verisi otomatik silinmez.
