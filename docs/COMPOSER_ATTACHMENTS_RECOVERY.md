# Composer Ekleri — Recovery

## Queue recovery
Attachment queue kalıcı olmadığı için browser refresh sonrası staged files geri yüklenmez.

Bu bilinçli bir privacy kararıdır; kullanıcı dosyayı yeniden seçer.

## Undo recovery
Son insert snapshot yalnız aktif sayfa memory'sinde tutulur. Sayfa kapanınca recovery yoktur.

## Failure recovery
Read error yaşayan dosya queue'ye girmez. Geçerli dosyalar kalır.

## User action
Kullanıcı insert sonrası composer'ı manuel değiştirmişse undo güvenli biçimde vazgeçebilir.

## Export
Attachment queue için otomatik export bulunmaz. Dosya içeriğinin sessizce yedeklenmesi engellenir.

## Support
Recovery gerektiğinde kullanıcıdan kaynak dosyayı yeniden seçmesi istenir; server-side attachment store yoktur.